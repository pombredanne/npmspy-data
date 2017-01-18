FROM mhart/alpine-node:4.7.2

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install --production

COPY q-consumer.js /usr/src/app
COPY db-importer.js /usr/src/app

CMD [ "node", "q-consumer" ]