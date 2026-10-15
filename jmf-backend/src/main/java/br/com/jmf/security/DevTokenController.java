package br.com.jmf.security;

import br.com.jmf.config.JmfProperties;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.Date;
import java.util.Map;

/**
 * SOMENTE DESENVOLVIMENTO: emite tokens HS256 para testar a API sem o Neon Auth.
 * Bean criado apenas no perfil "dev" e útil apenas com jmf.auth.mode=hmac.
 */
@Profile("dev")
@RestController
@RequestMapping("/api/dev")
public class DevTokenController {

    private final JmfProperties props;
    private final Clock clock;

    public DevTokenController(JmfProperties props, Clock clock) {
        this.props = props;
        this.clock = clock;
    }

    public record DevTokenRequest(
            @NotBlank @Size(max = 64) @Pattern(regexp = "[A-Za-z0-9_-]+") String sub,
            @Size(max = 120) String name,
            @Size(max = 254) String email,
            @Pattern(regexp = "admin|user|authenticated") String role) {
    }

    @PostMapping("/token")
    public Map<String, String> token(@Valid @RequestBody DevTokenRequest body) throws JOSEException {
        if (!"hmac".equalsIgnoreCase(props.auth().mode())) {
            throw new IllegalStateException("Disponível apenas com jmf.auth.mode=hmac");
        }
        String issuer = props.auth().issuer() == null || props.auth().issuer().isBlank() ? "jmf-dev" : props.auth().issuer();
        Date now = Date.from(clock.instant());
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(body.sub())
                .issuer(issuer)
                .issueTime(now)
                .expirationTime(Date.from(clock.instant().plus(Duration.ofHours(8))))
                .claim("email", body.email() == null ? body.sub() + "@jmf.dev" : body.email())
                .claim("name", body.name() == null ? body.sub() : body.name())
                .claim("role", body.role() == null ? "authenticated" : body.role())
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        jwt.sign(new MACSigner(props.auth().hmacSecret().getBytes(StandardCharsets.UTF_8)));
        return Map.of("token", jwt.serialize());
    }
}
