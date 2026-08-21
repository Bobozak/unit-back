FROM node:20

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

ENV HUSKY=0
RUN npm ci

COPY . .

RUN npm run build

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "run", "start:prod"]
