FROM node:18-alpine

LABEL maintainer="IITII <ccmejx@gmail.com>"

ADD . /app
WORKDIR /app
VOLUME ["/app/db", "/app/logs"]

RUN npm i

CMD ["npm", "start"]
