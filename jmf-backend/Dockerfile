# ---- build ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

# ---- runtime ----
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S jmf && adduser -S jmf -G jmf && mkdir -p /var/lib/jmf/attachments && chown -R jmf:jmf /var/lib/jmf
USER jmf
WORKDIR /app
COPY --from=build /app/target/jmf-backend-*.jar app.jar
ENV SPRING_PROFILES_ACTIVE=prod JMF_STORAGE_DIR=/var/lib/jmf/attachments
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
