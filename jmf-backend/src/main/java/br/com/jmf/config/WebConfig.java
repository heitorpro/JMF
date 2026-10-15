package br.com.jmf.config;

import br.com.jmf.common.CodedEnum;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.core.convert.converter.ConverterFactory;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.time.Clock;
import java.time.Duration;
import java.time.ZoneId;
import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    public static final ZoneId ZONE = ZoneId.of("America/Fortaleza"); // fuso de São Luís (UTC-3, sem horário de verão)

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverterFactory(new CodedEnumConverterFactory());
    }

    @Bean
    Clock clock() {
        return Clock.system(ZONE);
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(JmfProperties properties) {
        CorsConfiguration cors = new CorsConfiguration();
        List<String> origins = properties.cors() == null || properties.cors().allowedOrigins() == null
                ? List.of()
                : properties.cors().allowedOrigins().stream().map(String::trim).filter(o -> !o.isEmpty()).toList();
        cors.setAllowedOrigins(origins);
        cors.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Request-Id"));
        cors.setExposedHeaders(List.of("X-Request-Id", "Retry-After"));
        cors.setAllowCredentials(false); // autenticação por Bearer token, sem cookies
        cors.setMaxAge(Duration.ofHours(1));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", cors);
        return source;
    }

    /** Converte "?status=em_entrega" em RequestStatus.EM_ENTREGA (e equivalentes). */
    @SuppressWarnings({"rawtypes", "unchecked"})
    static final class CodedEnumConverterFactory implements ConverterFactory<String, Enum> {

        @Override
        public <T extends Enum> Converter<String, T> getConverter(Class<T> targetType) {
            if (CodedEnum.class.isAssignableFrom(targetType)) {
                return source -> source == null || source.isBlank()
                        ? null : (T) CodedEnum.fromCode((Class) targetType, source);
            }
            return source -> source == null || source.isBlank()
                    ? null : (T) Enum.valueOf(targetType, source.trim().toUpperCase());
        }
    }
}
