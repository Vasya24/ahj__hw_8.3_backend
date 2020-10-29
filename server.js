const http = require('http');
const Koa = require('koa');
const koaBody = require('koa-body');
const Router = require('koa-router');
const uuid = require('uuid');
const WS = require('ws');
const router = new Router();
const app = new Koa();

app.use(koaBody({
    urlencoded: true,
    multipart: true,
    json: true,
    text: true,
}));

app.use(async (ctx, next) => {
    const origin = ctx.request.get('Origin');
    if (!origin) {
      return await next();
    }

    const headers = { 'Access-Control-Allow-Origin': '*', };

    if (ctx.request.method !== 'OPTIONS') {
      ctx.response.set({...headers});
      try {
        return await next();
      } catch (e) {
        e.headers = {...e.headers, ...headers};
        throw e;
      }
    }

    if (ctx.request.get('Access-Control-Request-Method')) {
      ctx.response.set({
        ...headers,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
      });

      if (ctx.request.get('Access-Control-Request-Headers')) {
        ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
      }

      ctx.response.status = 204;
    }
  });

  const port = process.env.PORT || 7070;
  const server = http.createServer(app.callback());
  const wsServer = new WS.Server({ server });

  function createDate() {
    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear().toString().slice(2);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds} ${day < 10 ? '0' : ''}${day}.${month < 10 ? '0' : ''}${month}.${year}`;
  }

  function sendLog(id, key) {
    [...wsServer.clients]
    .filter(el => {
      return el.readyState === WS.OPEN;
    })
    .forEach(el => el.send(JSON.stringify({
      type: 'message',
      name: id,
      message: key,
      date: createDate(),
    })));
  }

  const instances = [];

  router.get('/instances', async (ctx, next) => {
    console.log(instances);
    ctx.response.body = instances;
  });

  router.post('/instances', async (ctx, next) => {
    const id = uuid.v4();

    sendLog(id, 'received create command');

    setTimeout(() => {
      instances.push({
        id,
        state: 'stopped',
      });
      sendLog(id, 'created');
    }, 20000);

    ctx.response.body = {
      status: 'ok'
    }
  });

  router.patch('/instances/:id', async (ctx, next) => {
    console.log(ctx.params.id);
    sendLog(ctx.params.id, 'received change status command');

    const index = instances.findIndex((el) => el.id === ctx.params.id);
    console.log(index);
    if (index !== -1) {
      setTimeout(() => {
        const status = instances[index].state;
        instances[index].state = status === 'stopped' ? 'running' : 'stopped';
        sendLog(ctx.params.id, instances[index].state);
      }, 20000);
    }

    ctx.response.body = {
      status: 'ok'
    }
  });

  router.delete('/instances/:id', async (ctx, next) => {
    console.log(ctx.params.id);
    const index = instances.findIndex((el) => el.id === ctx.params.id);
    console.log(index);
    if (index !== -1) {
      sendLog(ctx.params.id, 'received removed command');
      setTimeout(() => {
        instances.splice(index, 1);
        sendLog(ctx.params.id, 'removed');
      }, 20000);
    }

    ctx.response.body = {
      status: 'ok'
    }
  });

  wsServer.on('connection', (ws, req) => {
    console.log('Connected to server');

    ws.on('message', msg => {
      console.log('msg');

      [...wsServer.clients]
      .filter(el => {
        return el.readyState === WS.OPEN;
      })
      .forEach(el => el.send(msg));
    });

    ws.on('close', msg => {
      console.log('Closed server');

      [...wsServer.clients]
      .filter(el => {
        return el.readyState === WS.OPEN;
      })
      .forEach(el => el.send(JSON.stringify({type: 'logout'})));
    });

    [...wsServer.clients]
      .filter(el => {
        return el.readyState === WS.OPEN;
      })
      .forEach(el => el.send(JSON.stringify({type: 'login'})));
  });

  app.use(router.routes()).use(router.allowedMethods());

  server.listen(port);
