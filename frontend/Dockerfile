FROM 076614340621.dkr.ecr.us-east-1.amazonaws.com/lgcomus-base-nginx-shared:1.29.3-alpine-slim

# Copy built files from builder
COPY ./dist /usr/share/nginx/html

# Copy nginx configuration (optional)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]