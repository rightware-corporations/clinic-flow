package com.rightware.clinicflow.platform.identity;

import com.rightware.clinicflow.platform.audit.AuditWriter;
import com.rightware.clinicflow.platform.tenancy.TenantAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
public class UserInvitationController {
    private final NamedParameterJdbcTemplate jdbc;
    private final TenantAccessService tenants;
    private final AuditWriter audit;
    private final InvitationTokenService tokens;
    private final PasswordEncoder encoder;

    @Value("${clinicflow.invites.ttl-hours:72}")
    private long ttlHours;

    public UserInvitationController(NamedParameterJdbcTemplate jdbc,
                                    TenantAccessService tenants,
                                    AuditWriter audit,
                                    InvitationTokenService tokens,
                                    PasswordEncoder encoder) {
        this.jdbc=jdbc;
        this.tenants=tenants;
        this.audit=audit;
        this.tokens=tokens;
        this.encoder=encoder;
    }

    @GetMapping("/admin/invitations")
    public List<InvitationView> list(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                     Authentication auth) {
        tenants.requireClinicAdmin(auth,tenant);
        return jdbc.query("""
            SELECT id,email,display_name,role,expires_at,accepted_at,revoked_at,created_at
            FROM user_invitations
            WHERE tenant_id=:tenant
            ORDER BY created_at DESC
            LIMIT 200
            """,Map.of("tenant",tenant),(rs,row)->new InvitationView(
                rs.getObject("id",UUID.class),rs.getString("email"),
                rs.getString("display_name"),rs.getString("role"),
                rs.getObject("expires_at",OffsetDateTime.class),
                rs.getObject("accepted_at",OffsetDateTime.class),
                rs.getObject("revoked_at",OffsetDateTime.class),
                rs.getObject("created_at",OffsetDateTime.class)));
    }

    @PostMapping("/admin/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public InvitationCreated create(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                    @Valid @RequestBody InvitationInput input,
                                    Authentication auth) {
        var actor=tenants.requireClinicAdmin(auth,tenant);
        String email=input.email().trim().toLowerCase(Locale.ROOT);
        Integer existingMember=jdbc.queryForObject("""
            SELECT count(*) FROM users u
            JOIN tenant_memberships m ON m.user_id=u.id
            WHERE m.tenant_id=:tenant AND lower(u.email)=lower(:email) AND m.active
            """,Map.of("tenant",tenant,"email",email),Integer.class);
        if(existingMember!=null&&existingMember>0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,"ACTIVE_MEMBERSHIP_EXISTS");
        }
        List<UUID> expired=jdbc.queryForList("""
            SELECT id FROM user_invitations
            WHERE tenant_id=:tenant AND lower(email)=lower(:email)
              AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at<=now()
            FOR UPDATE
            """,Map.of("tenant",tenant,"email",email),UUID.class);
        if(!expired.isEmpty()) {
            jdbc.update("""
                UPDATE user_invitations SET revoked_at=now()
                WHERE tenant_id=:tenant AND lower(email)=lower(:email)
                  AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at<=now()
                """,Map.of("tenant",tenant,"email",email));
            for(UUID expiredId:expired) {
                audit.write(tenant,actor.userId(),"USER_INVITATION_EXPIRED_REPLACED",
                    "UserInvitation",expiredId);
            }
        }
        Integer activeInvite=jdbc.queryForObject("""
            SELECT count(*) FROM user_invitations
            WHERE tenant_id=:tenant AND lower(email)=lower(:email)
              AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()
            """,Map.of("tenant",tenant,"email",email),Integer.class);
        if(activeInvite!=null&&activeInvite>0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,"ACTIVE_INVITATION_EXISTS");
        }
        String token=tokens.generate();
        String tokenHash=tokens.hash(token);
        UUID id=UUID.randomUUID();
        OffsetDateTime expires=OffsetDateTime.now().plus(ttlHours,ChronoUnit.HOURS);
        jdbc.update("""
            INSERT INTO user_invitations
                (id,tenant_id,email,display_name,role,token_hash,expires_at,invited_by)
            VALUES(:id,:tenant,:email,:name,:role,:hash,:expires,:actor)
            """,new MapSqlParameterSource()
                .addValue("id",id).addValue("tenant",tenant)
                .addValue("email",email).addValue("name",input.displayName().trim())
                .addValue("role",input.role()).addValue("hash",tokenHash)
                .addValue("expires",expires).addValue("actor",actor.userId()));
        audit.write(tenant,actor.userId(),"USER_INVITATION_CREATED","UserInvitation",id);
        return new InvitationCreated(id,email,input.displayName().trim(),input.role(),expires,token);
    }

    @PostMapping("/admin/invitations/{id}/revoke")
    @Transactional
    public InvitationView revoke(@RequestHeader("X-Clinicflow-Tenant") UUID tenant,
                                 @PathVariable UUID id,
                                 Authentication auth) {
        var actor=tenants.requireClinicAdmin(auth,tenant);
        int changed=jdbc.update("""
            UPDATE user_invitations SET revoked_at=now()
            WHERE tenant_id=:tenant AND id=:id
              AND accepted_at IS NULL AND revoked_at IS NULL
            """,Map.of("tenant",tenant,"id",id));
        if(changed==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"ACTIVE_INVITATION_NOT_FOUND");
        audit.write(tenant,actor.userId(),"USER_INVITATION_REVOKED","UserInvitation",id);
        return invitation(tenant,id);
    }

    @GetMapping("/auth/invitations/current")
    public PublicInvitation inspect(@RequestHeader("X-Clinicflow-Invitation") String token) {
        requireTokenShape(token);
        var invite=findUsable(tokens.hash(token),false);
        Integer existing=jdbc.queryForObject("""
            SELECT count(*) FROM users WHERE lower(email)=lower(:email)
            """,Map.of("email",invite.email()),Integer.class);
        return new PublicInvitation(invite.displayName(),invite.email(),invite.role(),
            invite.clinicName(),invite.expiresAt(),existing!=null&&existing>0);
    }

    @PostMapping("/auth/invitations/current/accept")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AcceptedInvitation accept(
        @RequestHeader("X-Clinicflow-Invitation") String token,
        @Valid @RequestBody AcceptInvitation input) {
        requireTokenShape(token);
        String hash=tokens.hash(token);
        var invite=findUsable(hash,true);

        List<UserRecord> existing=jdbc.query("""
            SELECT id,email,display_name,enabled FROM users WHERE lower(email)=lower(:email)
            """,Map.of("email",invite.email()),(rs,row)->new UserRecord(
                rs.getObject("id",UUID.class),rs.getString("email"),
                rs.getString("display_name"),rs.getBoolean("enabled")));
        UUID userId;
        if(existing.isEmpty()) {
            if(input.password()==null||input.password().length()<14) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "NEW_ACCOUNT_PASSWORD_MIN_14");
            }
            userId=UUID.randomUUID();
            jdbc.update("""
                INSERT INTO users(id,email,display_name,password_hash)
                VALUES(:id,:email,:name,:hash)
                """,Map.of("id",userId,"email",invite.email(),
                    "name",invite.displayName(),"hash",encoder.encode(input.password())));
        } else {
            var user=existing.getFirst();
            if(!user.enabled()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,"ACCOUNT_DISABLED");
            }
            // An invitation must not silently reset the password of an existing account.
            if(input.existingAccountPassword()==null||input.existingAccountPassword().isBlank()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,"EXISTING_ACCOUNT_AUTH_REQUIRED");
            }
            String passwordHash=jdbc.queryForObject("""
                SELECT password_hash FROM users WHERE id=:id
                """,Map.of("id",user.id()),String.class);
            if(passwordHash==null||!encoder.matches(input.existingAccountPassword(),passwordHash)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"INVALID_EXISTING_ACCOUNT_PASSWORD");
            }
            userId=user.id();
        }

        Integer membership=jdbc.queryForObject("""
            SELECT count(*) FROM tenant_memberships
            WHERE tenant_id=:tenant AND user_id=:user
            """,Map.of("tenant",invite.tenantId(),"user",userId),Integer.class);
        if(membership!=null&&membership>0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,"MEMBERSHIP_ALREADY_EXISTS");
        }
        jdbc.update("""
            INSERT INTO tenant_memberships(tenant_id,user_id,role)
            VALUES(:tenant,:user,:role)
            """,Map.of("tenant",invite.tenantId(),"user",userId,"role",invite.role()));
        if("NURSE".equals(invite.role())) {
            jdbc.update("""
                INSERT INTO nursing_profiles(tenant_id,user_id)
                VALUES(:tenant,:user)
                """,Map.of("tenant",invite.tenantId(),"user",userId));
        }
        int used=jdbc.update("""
            UPDATE user_invitations SET accepted_at=now(),accepted_by=:user
            WHERE id=:id AND accepted_at IS NULL AND revoked_at IS NULL
              AND expires_at>now()
            """,Map.of("id",invite.id(),"user",userId));
        if(used!=1) throw new ResponseStatusException(HttpStatus.GONE,"INVITATION_NO_LONGER_VALID");
        audit.write(invite.tenantId(),userId,"USER_INVITATION_ACCEPTED","UserInvitation",invite.id());
        return new AcceptedInvitation(userId,invite.tenantId(),invite.role());
    }

    private static void requireTokenShape(String token) {
        if(token==null||token.length()<20||token.length()>200) {
            throw new ResponseStatusException(HttpStatus.GONE,"INVITATION_NO_LONGER_VALID");
        }
    }

    private InvitationView invitation(UUID tenant,UUID id) {
        return jdbc.query("""
            SELECT id,email,display_name,role,expires_at,accepted_at,revoked_at,created_at
            FROM user_invitations WHERE tenant_id=:tenant AND id=:id
            """,Map.of("tenant",tenant,"id",id),(rs,row)->new InvitationView(
                rs.getObject("id",UUID.class),rs.getString("email"),rs.getString("display_name"),
                rs.getString("role"),rs.getObject("expires_at",OffsetDateTime.class),
                rs.getObject("accepted_at",OffsetDateTime.class),
                rs.getObject("revoked_at",OffsetDateTime.class),
                rs.getObject("created_at",OffsetDateTime.class)))
            .stream().findFirst().orElseThrow(()->
                new ResponseStatusException(HttpStatus.NOT_FOUND,"INVITATION_NOT_FOUND"));
    }

    private InvitationRecord findUsable(String hash,boolean lock) {
        String sql="""
            SELECT i.id,i.tenant_id,i.email,i.display_name,i.role,i.expires_at,o.name clinic_name
            FROM user_invitations i
            JOIN organizations o ON o.id=i.tenant_id
            WHERE i.token_hash=:hash AND i.accepted_at IS NULL AND i.revoked_at IS NULL
              AND i.expires_at>now() AND o.status='ACTIVE'
            """+(lock?" FOR UPDATE OF i":"");
        return jdbc.query(sql,Map.of("hash",hash),(rs,row)->new InvitationRecord(
            rs.getObject("id",UUID.class),rs.getObject("tenant_id",UUID.class),
            rs.getString("email"),rs.getString("display_name"),rs.getString("role"),
            rs.getObject("expires_at",OffsetDateTime.class),rs.getString("clinic_name")))
            .stream().findFirst().orElseThrow(()->
                new ResponseStatusException(HttpStatus.GONE,"INVITATION_NO_LONGER_VALID"));
    }

    public record InvitationInput(
        @Email @NotBlank @Size(max=254) String email,
        @NotBlank @Size(max=160) String displayName,
        @NotBlank @Pattern(regexp="RECEPTION|PRACTITIONER|NURSE|INTERN") String role) {}
    public record AcceptInvitation(
        @Size(max=128) String password,
        @Size(max=128) String existingAccountPassword) {}
    public record InvitationCreated(UUID id,String email,String displayName,String role,
        OffsetDateTime expiresAt,String token) {}
    public record InvitationView(UUID id,String email,String displayName,String role,
        OffsetDateTime expiresAt,OffsetDateTime acceptedAt,OffsetDateTime revokedAt,
        OffsetDateTime createdAt) {}
    public record PublicInvitation(String displayName,String email,String role,
        String clinicName,OffsetDateTime expiresAt,boolean existingAccount) {}
    public record AcceptedInvitation(UUID userId,UUID tenantId,String role) {}
    private record InvitationRecord(UUID id,UUID tenantId,String email,String displayName,
        String role,OffsetDateTime expiresAt,String clinicName) {}
    private record UserRecord(UUID id,String email,String displayName,boolean enabled) {}
}
