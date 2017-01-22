FROM smebberson/alpine-nginx-nodejs

COPY nginx.conf /etc/nginx/

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install --production

COPY server.js /usr/src/app

CMD [ "node", "server" ]