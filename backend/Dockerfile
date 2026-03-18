FROM 076614340621.dkr.ecr.us-east-1.amazonaws.com/lgcomus-base-openjdk-jre-shared:java_v21_03022025
LABEL COMPANY="LG"
LABEL MAINTAINER="LG CNS"
LABEL APPLICATION="Admin Service"
RUN apt-get update; apt-get install -y curl
RUN curl -O https://download.newrelic.com/newrelic/java-agent/newrelic-agent/NR_AGENT_VERSION/newrelic-agent-NR_AGENT_VERSION.jar
RUN mkdir -p /agent
RUN mv newrelic-agent-NR_AGENT_VERSION.jar /agent/newrelic-agent.jar
ARG JAR_FILE=build/*.jar
EXPOSE 8080
COPY agent/newrelic.yml agent/newrelic.yml
COPY build/libs/admin-service-backend-0.0.1.jar admin-service-backend.jar
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /admin-service-backend.jar"]
