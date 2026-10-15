package br.com.jmf.security;

import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.OctetKeyPair;
import com.nimbusds.jose.util.Base64URL;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Tokens no formato do Neon Auth: EdDSA/Ed25519, iss = origem da URL do Neon Auth. */
class NeonJwtDecoderTest {

    private static final String ISSUER = "https://ep-test.neonauth.sa-east-1.aws.neon.tech";
    private static final Instant NOW = Instant.parse("2026-10-08T12:00:00Z");

    private KeyPair keys;
    private NeonJwtDecoder decoder;

    @BeforeEach
    void setUp() throws Exception {
        keys = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
        byte[] encoded = keys.getPublic().getEncoded();
        byte[] rawX = Arrays.copyOfRange(encoded, encoded.length - 32, encoded.length);
        JWK jwk = new OctetKeyPair.Builder(Curve.Ed25519, Base64URL.encode(rawX)).keyID("k1").build();
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        JwksProvider jwks = new JwksProvider(URI.create("https://unused.invalid/jwks"), Duration.ofMinutes(10), clock) {
            @Override
            public Optional<JWK> find(String keyId) {
                return "k1".equals(keyId) ? Optional.of(jwk) : Optional.empty();
            }
        };
        decoder = new NeonJwtDecoder(jwks, ISSUER, null, Duration.ofSeconds(60), clock);
    }

    @Test
    void aceitaTokenValido() throws Exception {
        String token = sign("k1", payload(ISSUER, NOW.plusSeconds(600)));
        Jwt jwt = decoder.decode(token);
        assertEquals("user-123", jwt.getSubject());
        assertEquals("admin", jwt.getClaimAsString("role"));
        assertEquals(NOW.plusSeconds(600), jwt.getExpiresAt());
    }

    @Test
    void rejeitaExpiradoEmissorErradoChaveDesconhecidaEAssinaturaAdulterada() throws Exception {
        assertThrows(BadJwtException.class, () -> decoder.decode(sign("k1", payload(ISSUER, NOW.minusSeconds(120)))));
        assertThrows(BadJwtException.class, () -> decoder.decode(sign("k1", payload("https://evil.example", NOW.plusSeconds(600)))));
        assertThrows(BadJwtException.class, () -> decoder.decode(sign("k2", payload(ISSUER, NOW.plusSeconds(600)))));

        String valid = sign("k1", payload(ISSUER, NOW.plusSeconds(600)));
        String[] parts = valid.split("\\.");
        String forgedPayload = b64(payload(ISSUER, NOW.plusSeconds(600)).replace("user-123", "user-999"));
        assertThrows(BadJwtException.class, () -> decoder.decode(parts[0] + "." + forgedPayload + "." + parts[2]));
    }

    @Test
    void rejeitaAlgNone() {
        String header = b64("{\"alg\":\"none\",\"kid\":\"k1\"}");
        String body = b64(payload(ISSUER, NOW.plusSeconds(600)));
        assertThrows(BadJwtException.class, () -> decoder.decode(header + "." + body + "."));
    }

    private static String payload(String issuer, Instant exp) {
        return "{\"sub\":\"user-123\",\"iss\":\"" + issuer + "\",\"aud\":\"" + issuer + "\",\"exp\":" + exp.getEpochSecond()
                + ",\"iat\":" + NOW.minusSeconds(10).getEpochSecond()
                + ",\"email\":\"joao@email.com\",\"name\":\"João\",\"role\":\"admin\"}";
    }

    private String sign(String kid, String payload) throws Exception {
        String signingInput = b64("{\"alg\":\"EdDSA\",\"kid\":\"" + kid + "\",\"typ\":\"JWT\"}") + "." + b64(payload);
        Signature signer = Signature.getInstance("Ed25519");
        signer.initSign(keys.getPrivate());
        signer.update(signingInput.getBytes(StandardCharsets.US_ASCII));
        return signingInput + "." + Base64URL.encode(signer.sign());
    }

    private static String b64(String json) {
        return Base64URL.encode(json.getBytes(StandardCharsets.UTF_8)).toString();
    }
}
