package br.com.jmf.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.OctetKeyPair;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.MappedJwtClaimSetConverter;

import java.text.ParseException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Decodificador de JWT do Neon Auth.
 *
 * <p>O Neon Auth assina com EdDSA (Ed25519), algoritmo que o {@code NimbusJwtDecoder} padrão do Spring
 * não suporta. Este decoder verifica Ed25519 com a JCA nativa e mantém suporte a RS256/ES256 caso o
 * provedor mude. Validações: assinatura, exp/nbf (com tolerância), iss e — se configurado — aud.</p>
 */
public class NeonJwtDecoder implements JwtDecoder {

    private static final Set<String> EDDSA = Set.of("EdDSA", "Ed25519");
    private static final Set<String> RSA = Set.of("RS256", "RS384", "RS512", "PS256", "PS384", "PS512");
    private static final Set<String> EC = Set.of("ES256", "ES384", "ES512");

    private static final Converter<Map<String, Object>, Map<String, Object>> CLAIM_CONVERTER =
            MappedJwtClaimSetConverter.withDefaults(Collections.emptyMap());

    private final JwksProvider jwks;
    private final String issuer;
    private final String audience;
    private final Duration clockSkew;
    private final Clock clock;

    public NeonJwtDecoder(JwksProvider jwks, String issuer, String audience, Duration clockSkew, Clock clock) {
        this.jwks = jwks;
        this.issuer = issuer;
        this.audience = audience == null || audience.isBlank() ? null : audience;
        this.clockSkew = clockSkew == null ? Duration.ofSeconds(60) : clockSkew;
        this.clock = clock;
    }

    @Override
    public Jwt decode(String token) throws JwtException {
        SignedJWT jwt;
        JWTClaimsSet claims;
        try {
            jwt = SignedJWT.parse(token);
            claims = jwt.getJWTClaimsSet();
        } catch (ParseException e) {
            throw new BadJwtException("Token malformado");
        }

        JWSHeader header = jwt.getHeader();
        String alg = header.getAlgorithm().getName();
        JWK key = jwks.find(header.getKeyID()).orElseThrow(() -> new BadJwtException("Chave de assinatura desconhecida"));
        if (!verifySignature(jwt, alg, key)) {
            throw new BadJwtException("Assinatura inválida");
        }
        validateClaims(claims);

        Map<String, Object> converted = CLAIM_CONVERTER.convert(claims.toJSONObject());
        return Jwt.withTokenValue(token)
                .headers(h -> h.putAll(header.toJSONObject()))
                .claims(c -> c.putAll(converted))
                .build();
    }

    private static boolean verifySignature(SignedJWT jwt, String alg, JWK key) {
        try {
            if (EDDSA.contains(alg) && key instanceof OctetKeyPair okp && Curve.Ed25519.equals(okp.getCurve())) {
                return Ed25519Verifier.verify(okp.getX().decode(), jwt.getSigningInput(), jwt.getSignature().decode());
            }
            if (RSA.contains(alg) && key instanceof RSAKey rsa) {
                return jwt.verify(new RSASSAVerifier(rsa.toRSAPublicKey()));
            }
            if (EC.contains(alg) && key instanceof ECKey ec) {
                return jwt.verify(new ECDSAVerifier(ec.toECPublicKey()));
            }
            return false; // algoritmo não permitido (inclui "none" e HMAC) ou chave incompatível
        } catch (JOSEException e) {
            return false;
        }
    }

    private void validateClaims(JWTClaimsSet claims) {
        Instant now = clock.instant();
        Date exp = claims.getExpirationTime();
        if (exp == null || now.minus(clockSkew).isAfter(exp.toInstant())) {
            throw new BadJwtException("Token expirado");
        }
        Date nbf = claims.getNotBeforeTime();
        if (nbf != null && now.plus(clockSkew).isBefore(nbf.toInstant())) {
            throw new BadJwtException("Token ainda não é válido");
        }
        if (issuer != null && !issuer.equals(claims.getIssuer())) {
            throw new BadJwtException("Emissor inválido");
        }
        if (audience != null) {
            List<String> aud = claims.getAudience();
            if (aud == null || !aud.contains(audience)) {
                throw new BadJwtException("Audiência inválida");
            }
        }
        if (claims.getSubject() == null || claims.getSubject().isBlank()) {
            throw new BadJwtException("Token sem subject");
        }
    }
}
