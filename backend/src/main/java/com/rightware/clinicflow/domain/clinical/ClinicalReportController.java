package com.rightware.clinicflow.domain.clinical;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Clinician-authored records only. Do not put clinical content in logging/audit events. */
@RestController
@RequestMapping("/api/v1/clinical-reports")
public class ClinicalReportController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AuditWriter audit;

    public ClinicalReportController(NamedParameterJdbcTemplate jdbc,
                                    TenantAccessService tenants, AuditWriter audit) {
        this.jdbc=jdbc;
        this.tenants=tenants;
        this.audit=audit;
    }

    @GetMapping
    @Transactional
    public ReportPage list(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                           @RequestParam(defaultValue="0") int page,
                           Authentication authentication) {
        var author=requireClinicalAuthor(authentication,tenant);
        if(page<0||page>10000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"INVALID_REPORT_PAGE");
        }
        var args=new MapSqlParameterSource().addValue("tenant",tenant)
            .addValue("author",author.userId()).addValue("limit",30)
            .addValue("offset",page*30L);
        Long total=jdbc.queryForObject("""
            SELECT count(*) FROM clinical_reports
            WHERE tenant_id=:tenant AND author_id=:author
            """,args,Long.class);
        List<ReportSummary> items=jdbc.query("""
            SELECT r.id,r.appointment_id,r.patient_id,p.name AS patient_name,
                   r.report_type,r.status,r.version,r.created_at,r.updated_at,r.finalized_at
            FROM clinical_reports r
            JOIN patients p ON p.tenant_id=r.tenant_id AND p.id=r.patient_id
            WHERE r.tenant_id=:tenant AND r.author_id=:author
            ORDER BY r.updated_at DESC,r.id LIMIT :limit OFFSET :offset
            """,args,(rs,index)->summary(rs));
        audit.write(tenant,author.userId(),"CLINICAL_REPORT_INDEX_READ","Organization",tenant);
        return new ReportPage(items,total==null?0:total,page,30);
    }

    @GetMapping("/{id}")
    @Transactional
    public ReportDetail get(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                            @PathVariable UUID id,Authentication authentication) {
        var author=requireClinicalAuthor(authentication,tenant);
        ReportDetail report=findOwn(tenant,id,author.userId());
        audit.write(tenant,author.userId(),"CLINICAL_REPORT_READ","ClinicalReport",id);
        return report;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ReportDetail create(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                               @Valid @RequestBody ReportInput input,
                               Authentication authentication) {
        var author=requireClinicalAuthor(authentication,tenant);
        Integer appointment=jdbc.queryForObject("""
            SELECT count(*) FROM appointments a
            JOIN patients p ON p.tenant_id=a.tenant_id AND p.id=a.patient_id
            WHERE a.tenant_id=:tenant AND a.id=:appointment
              AND a.practitioner_user_id=:author AND p.archived_at IS NULL
              AND a.status IN ('IN_PROGRESS','COMPLETED')
            """,Map.of("tenant",tenant,"appointment",input.appointmentId(),
                "author",author.userId()),Integer.class);
        if(appointment==null||appointment==0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "ACTIVE_ASSIGNED_ENCOUNTER_REQUIRED");
        }
        UUID id=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO clinical_reports
                (tenant_id,id,appointment_id,patient_id,author_id,report_type,
                 symptoms,diagnosis,observations,treatment,notes)
            SELECT :tenant,:id,a.id,a.patient_id,:author,:type,
                   :symptoms,:diagnosis,:observations,:treatment,:notes
            FROM appointments a WHERE a.tenant_id=:tenant AND a.id=:appointment
              AND a.practitioner_user_id=:author AND a.status IN ('IN_PROGRESS','COMPLETED')
            """,contentArgs(tenant,id,author.userId(),input));
        event(tenant,id,author.userId(),"CREATE",0);
        audit.write(tenant,author.userId(),"CLINICAL_REPORT_CREATED","ClinicalReport",id);
        return findOwn(tenant,id,author.userId());
    }

    @PutMapping("/{id}")
    @Transactional
    public ReportDetail update(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                               @PathVariable UUID id,
                               @Valid @RequestBody ReportInput input,
                               Authentication authentication) {
        var author=requireClinicalAuthor(authentication,tenant);
        if(input.version()==null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"VERSION_REQUIRED");
        }
        int changed=jdbc.update("""
            UPDATE clinical_reports SET report_type=:type,
                symptoms=:symptoms,diagnosis=:diagnosis,
                observations=:observations,treatment=:treatment,notes=:notes,
                version=version+1,updated_at=now()
            WHERE tenant_id=:tenant AND id=:id AND author_id=:author
              AND appointment_id=:appointment AND status='DRAFT'
              AND version=:version
            """,contentArgs(tenant,id,author.userId(),input)
                .addValue("version",input.version()));
        if(changed==0) ownConflictOrMissing(tenant,id,author.userId());
        event(tenant,id,author.userId(),"EDIT_DRAFT",input.version()+1);
        audit.write(tenant,author.userId(),"CLINICAL_REPORT_DRAFT_UPDATED","ClinicalReport",id);
        return findOwn(tenant,id,author.userId());
    }

    @PostMapping("/{id}/finalize")
    @Transactional
    public ReportDetail finalizeReport(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                       @PathVariable UUID id,
                                       @Valid @RequestBody VersionInput input,
                                       Authentication authentication) {
        var author=requireClinicalAuthor(authentication,tenant);
        ReportDetail before=findOwn(tenant,id,author.userId());
        if(!before.summary().status().equals("DRAFT")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,"REPORT_ALREADY_FINALIZED");
        }
        if(before.summary().version()!=input.version()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,"STALE_REPORT_VERSION");
        }
        if(List.of(before.symptoms(),before.diagnosis(),before.observations(),before.treatment())
            .stream().allMatch(String::isBlank)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"REPORT_CONTENT_REQUIRED");
        }
        int changed=jdbc.update("""
            UPDATE clinical_reports SET status='FINALIZED',finalized_at=now(),
                version=version+1,updated_at=now()
            WHERE tenant_id=:tenant AND id=:id AND author_id=:author
              AND version=:version AND status='DRAFT'
            """,Map.of("tenant",tenant,"id",id,"author",author.userId(),
                "version",input.version()));
        if(changed==0) ownConflictOrMissing(tenant,id,author.userId());
        event(tenant,id,author.userId(),"FINALIZE",input.version()+1);
        audit.write(tenant,author.userId(),"CLINICAL_REPORT_FINALIZED","ClinicalReport",id);
        return findOwn(tenant,id,author.userId());
    }

    @PostMapping("/{id}/addenda")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AddendumView addAddendum(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                   @PathVariable UUID id,
                                   @RequestHeader("Idempotency-Key") UUID key,
                                   @Valid @RequestBody AddendumInput input,
                                   Authentication authentication) {
        var author=requireClinicalAuthor(authentication,tenant);
        // Serializes duplicate submissions before inspecting idempotency.
        List<String> states=jdbc.queryForList("""
            SELECT status FROM clinical_reports
            WHERE tenant_id=:tenant AND id=:id AND author_id=:author FOR UPDATE
            """,Map.of("tenant",tenant,"id",id,"author",author.userId()),String.class);
        if(states.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"REPORT_NOT_FOUND");
        }
        if(!states.getFirst().equals("FINALIZED")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,"ADDENDUM_REQUIRES_FINALIZED_REPORT");
        }
        String content=input.content().trim();
        String fingerprint=sha(content);
        List<AddendumFingerprint> previous=jdbc.query("""
            SELECT id,content_sha FROM clinical_report_addenda
            WHERE tenant_id=:tenant AND report_id=:report
              AND author_id=:author AND idempotency_key=:key
            """,Map.of("tenant",tenant,"report",id,"author",author.userId(),"key",key),
            (rs,row)->new AddendumFingerprint(rs.getObject("id",UUID.class),
                rs.getString("content_sha").trim()));
        if(!previous.isEmpty()) {
            if(!previous.getFirst().sha().equals(fingerprint)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,"IDEMPOTENCY_KEY_REUSED");
            }
            return findAddendum(tenant,previous.getFirst().id());
        }
        UUID addendumId=UUID.randomUUID();
        jdbc.update("""
            INSERT INTO clinical_report_addenda
                (tenant_id,id,report_id,author_id,content,idempotency_key,content_sha)
            VALUES(:tenant,:id,:report,:author,:content,:key,:hash)
            """,Map.of("tenant",tenant,"id",addendumId,"report",id,
                "author",author.userId(),"content",content,
                "key",key,"hash",fingerprint));
        Long current=jdbc.queryForObject("""
            SELECT version FROM clinical_reports
            WHERE tenant_id=:tenant AND id=:id AND author_id=:author
            """,Map.of("tenant",tenant,"id",id,"author",author.userId()),Long.class);
        event(tenant,id,author.userId(),"ADD_ADDENDUM",current==null?0:current);
        audit.write(tenant,author.userId(),"CLINICAL_REPORT_ADDENDUM_CREATED",
            "ClinicalReport",id);
        return findAddendum(tenant,addendumId);
    }

    private TenantAccessService.TenantAccess requireClinicalAuthor(
        Authentication auth,UUID tenant) {
        var member=tenants.requireMembership(auth,tenant);
        if(!member.role().equals("PRACTITIONER")) {
            throw new AccessDeniedException("Clinical report content is restricted to clinicians");
        }
        Integer active=jdbc.queryForObject("""
            SELECT count(*) FROM practitioner_profiles
            WHERE tenant_id=:tenant AND user_id=:user AND active
            """,Map.of("tenant",tenant,"user",member.userId()),Integer.class);
        if(active==null||active==0) {
            throw new AccessDeniedException("Active practitioner profile required");
        }
        return member;
    }

    private ReportDetail findOwn(UUID tenant,UUID id,UUID author) {
        List<ReportDetail> rows=jdbc.query("""
            SELECT r.id,r.appointment_id,r.patient_id,p.name AS patient_name,
                r.report_type,r.status,r.version,r.created_at,r.updated_at,r.finalized_at,
                r.symptoms,r.diagnosis,r.observations,r.treatment,r.notes
            FROM clinical_reports r
            JOIN patients p ON p.tenant_id=r.tenant_id AND p.id=r.patient_id
            WHERE r.tenant_id=:tenant AND r.id=:id AND r.author_id=:author
            """,Map.of("tenant",tenant,"id",id,"author",author),(rs,index)->
                new ReportDetail(summary(rs),rs.getString("symptoms"),
                    rs.getString("diagnosis"),rs.getString("observations"),
                    rs.getString("treatment"),rs.getString("notes"),List.of()));
        if(rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"REPORT_NOT_FOUND");
        }
        List<AddendumView> addenda=jdbc.query("""
            SELECT id,report_id,author_id,content,created_at
            FROM clinical_report_addenda WHERE tenant_id=:tenant AND report_id=:report
            ORDER BY created_at,id
            """,Map.of("tenant",tenant,"report",id),(rs,index)->addendumRow(rs));
        ReportDetail item=rows.getFirst();
        return new ReportDetail(item.summary(),item.symptoms(),item.diagnosis(),
            item.observations(),item.treatment(),item.notes(),addenda);
    }

    private AddendumView findAddendum(UUID tenant,UUID id) {
        return jdbc.query("""
            SELECT id,report_id,author_id,content,created_at
            FROM clinical_report_addenda WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",tenant,"id",id),(rs,index)->addendumRow(rs))
            .stream().findFirst().orElseThrow(()->
                new ResponseStatusException(HttpStatus.NOT_FOUND,"ADDENDUM_NOT_FOUND"));
    }

    private void ownConflictOrMissing(UUID tenant,UUID id,UUID author) {
        Integer count=jdbc.queryForObject("""
            SELECT count(*) FROM clinical_reports
            WHERE tenant_id=:tenant AND id=:id AND author_id=:author
            """,Map.of("tenant",tenant,"id",id,"author",author),Integer.class);
        throw new ResponseStatusException(count!=null&&count>0
            ?HttpStatus.CONFLICT:HttpStatus.NOT_FOUND,
            count!=null&&count>0?"REPORT_FINALIZED_OR_STALE":"REPORT_NOT_FOUND");
    }

    private void event(UUID tenant,UUID id,UUID author,String action,long version) {
        jdbc.update("""
            INSERT INTO clinical_report_events
                (tenant_id,id,report_id,actor_id,action,report_version)
            VALUES(:tenant,:id,:report,:actor,:action,:version)
            """,Map.of("tenant",tenant,"id",UUID.randomUUID(),"report",id,
                "actor",author,"action",action,"version",version));
    }

    private static MapSqlParameterSource contentArgs(UUID tenant,UUID id,UUID author,
                                                     ReportInput input) {
        return new MapSqlParameterSource()
            .addValue("tenant",tenant).addValue("id",id).addValue("author",author)
            .addValue("appointment",input.appointmentId())
            .addValue("type",input.reportType())
            .addValue("symptoms",optional(input.symptoms()))
            .addValue("diagnosis",optional(input.diagnosis()))
            .addValue("observations",optional(input.observations()))
            .addValue("treatment",optional(input.treatment()))
            .addValue("notes",optional(input.notes()));
    }
    private static String optional(String value) {
        return value==null?"":value.trim();
    }
    private static ReportSummary summary(ResultSet rs)throws SQLException {
        return new ReportSummary(rs.getObject("id",UUID.class),
            rs.getObject("appointment_id",UUID.class),rs.getObject("patient_id",UUID.class),
            rs.getString("patient_name"),rs.getString("report_type"),rs.getString("status"),
            rs.getLong("version"),rs.getObject("created_at",OffsetDateTime.class),
            rs.getObject("updated_at",OffsetDateTime.class),
            rs.getObject("finalized_at",OffsetDateTime.class));
    }
    private static AddendumView addendumRow(ResultSet rs)throws SQLException {
        return new AddendumView(rs.getObject("id",UUID.class),
            rs.getObject("report_id",UUID.class),rs.getObject("author_id",UUID.class),
            rs.getString("content"),rs.getObject("created_at",OffsetDateTime.class));
    }
    private static String sha(String content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(content.getBytes(StandardCharsets.UTF_8)));
        }catch(NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 unavailable",error);
        }
    }

    public record ReportInput(@NotNull UUID appointmentId,
        @NotBlank @Pattern(regexp="CONSULTATION|DIAGNOSTIC|FOLLOW_UP") String reportType,
        @Size(max=8000) String symptoms,@Size(max=8000) String diagnosis,
        @Size(max=8000) String observations,@Size(max=8000) String treatment,
        @Size(max=8000) String notes,@Min(0) Long version) {}
    public record VersionInput(@NotNull @Min(0) Long version) {}
    public record AddendumInput(@NotBlank @Size(max=8000) String content) {}
    public record ReportSummary(UUID id,UUID appointmentId,UUID patientId,
        String patientName,String reportType,String status,long version,
        OffsetDateTime createdAt,OffsetDateTime updatedAt,OffsetDateTime finalizedAt) {}
    public record ReportPage(List<ReportSummary> items,long total,int page,int size) {}
    public record AddendumView(UUID id,UUID reportId,UUID authorId,
        String content,OffsetDateTime createdAt) {}
    public record ReportDetail(ReportSummary summary,String symptoms,
        String diagnosis,String observations,String treatment,String notes,
        List<AddendumView> addenda) {}
    private record AddendumFingerprint(UUID id,String sha) {}
}
