package com.rightware.clinicflow.appointments;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AppointmentHttpIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired NamedParameterJdbcTemplate jdbc;

    @Test
    void idempotencyBookingConflictsAndLifecycleAreEnforced() throws Exception {
        Fixture f=fixture();
        LocalDateTime at=LocalDateTime.of(LocalDate.now().plusDays(2),LocalTime.of(9,0));
        UUID key=UUID.randomUUID();

        create(f,f.patient(),at,key)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("REQUESTED"))
            .andExpect(jsonPath("$.version").value(0));
        UUID id=appointmentId(f.tenant(),key,f.admin());

        create(f,f.patient(),at,key)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(id.toString()));
        assertEquals(1,countAppointments(f.tenant()));

        create(f,f.patient(),at,UUID.randomUUID())
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("CONSTRAINT_CONFLICT"));
        create(f,f.secondPatient(),at,UUID.randomUUID())
            .andExpect(status().isConflict()); // Same practitioner, different patient.

        String differing=body(f,f.secondPatient(),at.plusMinutes(30));
        mvc.perform(post("/api/v1/appointments")
            .with(user(email(f.admin()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .header("Idempotency-Key",key).contentType(MediaType.APPLICATION_JSON)
            .content(differing))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("IDEMPOTENCY_KEY_REUSED"));

        mvc.perform(get("/api/v1/appointments/"+id)
            .with(user(email(f.foreignAdmin())))
            .header("X-Clinicflow-Tenant",f.tenant()))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/appointments/"+id+"/start")
            .with(user(email(f.practitioner()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("INVALID_APPOINTMENT_STATE"));

        command(f,id,"confirm",0,f.admin())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CONFIRMED"))
            .andExpect(jsonPath("$.version").value(1));
        command(f,id,"confirm",0,f.admin()).andExpect(status().isConflict());
        command(f,id,"start",1,f.practitioner())
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("IN_PROGRESS"));
        command(f,id,"complete",2,f.practitioner())
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        command(f,id,"cancel",3,f.admin()).andExpect(status().isConflict());

        assertEquals(4,jdbc.queryForObject("""
            SELECT count(*) FROM appointment_events
            WHERE tenant_id=:tenant AND appointment_id=:appointment
            """,Map.of("tenant",f.tenant(),"appointment",id),Integer.class));
    }

    @Test
    void rescheduleVersionAndBlockValidation() throws Exception {
        Fixture f=fixture();
        LocalDateTime at=LocalDateTime.of(LocalDate.now().plusDays(3),LocalTime.of(9,0));
        UUID key=UUID.randomUUID();
        create(f,f.patient(),at,key).andExpect(status().isCreated());
        UUID id=appointmentId(f.tenant(),key,f.admin());
        String newDate=at.plusMinutes(30).toString();
        String reschedule="{\"version\":0,\"unitId\":\""+f.unit()+
            "\",\"startsAt\":\""+newDate+"\"}";
        mvc.perform(post("/api/v1/appointments/"+id+"/reschedule")
            .with(user(email(f.admin()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON).content(reschedule))
            .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1))
            .andExpect(jsonPath("$.startsAt").value(newDate+":00"));
        mvc.perform(post("/api/v1/appointments/"+id+"/reschedule")
            .with(user(email(f.admin()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON).content(reschedule))
            .andExpect(status().isConflict());

        UUID block=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO practitioner_schedule_blocks
                (id,tenant_id,practitioner_user_id,starts_at,ends_at,created_by)
            VALUES(:id,:tenant,:professional,:start,:end,:actor)
            """,new org.springframework.jdbc.core.namedparam.MapSqlParameterSource()
                .addValue("id",block).addValue("tenant",f.tenant())
                .addValue("professional",f.practitioner())
                .addValue("start",at.plusMinutes(60))
                .addValue("end",at.plusMinutes(90)).addValue("actor",f.admin()));
        String blocked="{\"version\":1,\"unitId\":\""+f.unit()+
            "\",\"startsAt\":\""+at.plusMinutes(60)+"\"}";
        mvc.perform(post("/api/v1/appointments/"+id+"/reschedule")
            .with(user(email(f.admin()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON).content(blocked))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value("SLOT_BLOCKED"));
    }

    @Test
    void simultaneousCreatesForSameDoctorCannotBothCommit() throws Exception {
        Fixture f=fixture();
        LocalDateTime at=LocalDateTime.of(LocalDate.now().plusDays(4),LocalTime.of(9,0));
        ExecutorService executor=Executors.newFixedThreadPool(2);
        CountDownLatch ready=new CountDownLatch(2);
        CountDownLatch go=new CountDownLatch(1);
        try {
            Callable<Integer> first=()->raceCreate(f,f.patient(),at,ready,go);
            Callable<Integer> second=()->raceCreate(f,f.secondPatient(),at,ready,go);
            Future<Integer> a=executor.submit(first);
            Future<Integer> b=executor.submit(second);
            assertTrue(ready.await(5,TimeUnit.SECONDS));
            go.countDown();
            int codeA=a.get(15,TimeUnit.SECONDS),codeB=b.get(15,TimeUnit.SECONDS);
            assertEquals(Set.of(201,409),Set.of(codeA,codeB));
            assertEquals(1,countAppointments(f.tenant()));
        }finally{go.countDown();executor.shutdownNow();}
    }

    private int raceCreate(Fixture f,UUID patient,LocalDateTime at,
                           CountDownLatch ready,CountDownLatch go)throws Exception{
        ready.countDown();
        if(!go.await(5,TimeUnit.SECONDS))throw new IllegalStateException("race gate timeout");
        return create(f,patient,at,UUID.randomUUID())
            .andReturn().getResponse().getStatus();
    }
    private ResultActions create(Fixture f,UUID patient,LocalDateTime at,UUID key)throws Exception{
        return mvc.perform(post("/api/v1/appointments")
            .with(user(email(f.admin()))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .header("Idempotency-Key",key)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(f,patient,at)));
    }
    private String body(Fixture f,UUID patient,LocalDateTime at){
        return """
            {"patientId":"%s","practitionerUserId":"%s","unitId":"%s",
             "serviceId":"%s","startsAt":"%s"}
            """.formatted(patient,f.practitioner(),f.unit(),f.service(),at);
    }
    private ResultActions command(Fixture f,UUID id,String command,long version,UUID actor)
        throws Exception {
        return mvc.perform(post("/api/v1/appointments/"+id+"/"+command)
            .with(user(email(actor))).with(csrf())
            .header("X-Clinicflow-Tenant",f.tenant())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"version\":"+version+"}"));
    }
    private UUID appointmentId(UUID tenant,UUID key,UUID creator){
        return jdbc.queryForObject("""
            SELECT id FROM appointments
            WHERE tenant_id=:tenant AND idempotency_key=:key AND created_by=:actor
            """,Map.of("tenant",tenant,"key",key,"actor",creator),UUID.class);
    }
    private int countAppointments(UUID tenant){
        return jdbc.queryForObject(
            "SELECT count(*) FROM appointments WHERE tenant_id=:tenant",
            Map.of("tenant",tenant),Integer.class);
    }
    private Fixture fixture(){
        UUID tenant=UUID.randomUUID(),foreign=UUID.randomUUID();
        insert("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id",tenant,"name","Booking Test "+tenant));
        insert("INSERT INTO organizations(id,name) VALUES(:id,:name)",
            Map.of("id",foreign,"name","Foreign Test "+foreign));
        UUID admin=user(tenant,"CLINIC_ADMIN"),practitioner=user(tenant,"PRACTITIONER");
        UUID foreignAdmin=user(foreign,"CLINIC_ADMIN");
        UUID patient=patient(tenant),second=patient(tenant);
        UUID unit=UUID.randomUUID(),service=UUID.randomUUID();
        insert("INSERT INTO clinic_units(id,tenant_id,name) VALUES(:id,:tenant,'General')",
            Map.of("id",unit,"tenant",tenant));
        insert("""
            INSERT INTO service_definitions(id,tenant_id,name,slug,duration_minutes)
            VALUES(:id,:tenant,'Consultation',:slug,30)
            """,Map.of("id",service,"tenant",tenant,"slug","consult-"+service));
        insert("""
            INSERT INTO practitioner_profiles(tenant_id,user_id,professional_title)
            VALUES(:tenant,:user,'Doctor')
            """,Map.of("tenant",tenant,"user",practitioner));
        insert("""
            INSERT INTO practitioner_units(tenant_id,practitioner_user_id,unit_id)
            VALUES(:tenant,:user,:unit)
            """,Map.of("tenant",tenant,"user",practitioner,"unit",unit));
        insert("""
            INSERT INTO practitioner_services(tenant_id,practitioner_user_id,service_id)
            VALUES(:tenant,:user,:service)
            """,Map.of("tenant",tenant,"user",practitioner,"service",service));
        for(int day=1;day<=7;day++){
            insert("""
                INSERT INTO practitioner_availability_rules(id,tenant_id,practitioner_user_id,
                    unit_id,day_of_week,start_time,end_time,slot_interval_minutes)
                VALUES(:id,:tenant,:user,:unit,:day,'09:00','12:00',30)
                """,Map.of("id",UUID.randomUUID(),"tenant",tenant,"user",practitioner,
                    "unit",unit,"day",day));
        }
        return new Fixture(tenant,admin,practitioner,foreignAdmin,patient,second,unit,service);
    }
    private UUID user(UUID tenant,String role){
        UUID id=UUID.randomUUID();
        insert("""
            INSERT INTO users(id,email,display_name,password_hash)
            VALUES(:id,:email,:name,'integration-only')
            """,Map.of("id",id,"email",email(id),"name",role));
        insert("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:id,:role)
            """,Map.of("tenant",tenant,"id",id,"role",role));
        return id;
    }
    private UUID patient(UUID tenant){
        UUID id=UUID.randomUUID();
        insert("""
            INSERT INTO patients(id,tenant_id,name,date_of_birth,gender)
            VALUES(:id,:tenant,:name,'1990-02-05','F')
            """,Map.of("id",id,"tenant",tenant,"name","Test "+id));
        return id;
    }
    private void insert(String sql,Map<String,?> params){jdbc.update(sql,params);}
    private String email(UUID id){return "appointment-"+id+"@example.invalid";}
    private record Fixture(UUID tenant,UUID admin,UUID practitioner,UUID foreignAdmin,
                           UUID patient,UUID secondPatient,UUID unit,UUID service){}
}
