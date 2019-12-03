const logger = require('./logger')

try {
  require('envkey')
} catch (error) {
  logger.warn('EnvKey not configured')
}

const express = require('express')
const app = express()
const Sentry = require('@sentry/node')
if (process.env.NODE_ENV === 'production' && process.env.SERVER_SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SERVER_SENTRY_DSN })
}
const cors = require('cors')
const bodyParser = require('body-parser')
const passport = require('passport')
const path = require('path')
const session = require('express-session')
const useragent = require('express-useragent')
require('./passport')()
const SQLiteStore = require('connect-sqlite3')(session)
const helmet = require('helmet')

const { sessionSecret, port } = require('./config')

// Session setup
const sessionConfig = {
  cookie: {
    secure: false,
    // 30 minute TTL
    maxAge: 30 * 60 * 1000,
    httpOnly: true
  },
  resave: false, // Do not force session to get saved if it was not modified by the request.
  saveUninitialized: true,
  secret: sessionSecret,
  store: new SQLiteStore({
    dir: path.resolve(__dirname + '/../data'),
    db: 'sessions.sqlite3'
  })
}

if (app.get('env') === 'production') {
  app.set('trust proxy', 1) // trust first proxy
  sessionConfig.cookie.secure = true // serve secure cookies in production
}

const corsWhitelist = [
  'https://investor.dev.originprotocol.com',
  'https://employee.dev.originprotocol.com',
  'http://localhost:3000'
]

// CORS setup
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsWhitelist.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    exposedHeaders: ['X-Authenticated-Email']
  })
)

app.use(helmet())

app.use(session(sessionConfig))

// Parse request bodies
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
// Passport specific
app.use(passport.initialize())
app.use(passport.session())

// User agent parsing
app.use(useragent.express())

app.use(require('./controllers'))

app.listen(port, () => {
  logger.info(`Listening on port ${port}`)
})

module.exports = app
