import Env from '@ioc:Adonis/Core/Env'
const { createLogger, format, transports } = require('winston')
const { combine, timestamp } = format
const DiscordTransport = require('winston-discord-webhook')

const logger = createLogger({
  format: combine(timestamp(), format.errors({ stack: true }), format.json()),
  transports: [
    new DiscordTransport({
      webhook: Env.get('WEBHOOK_LOG_DISCORD'),
      useCodeBlock: true,
      level: 'error',
      handleExceptions: true,
      format: format.combine(
        format.timestamp({ format: 'DD-MMM-YYYY HH:mm' }),
        format.align(),
        format.printf(
          (info) =>
            `ERRO ${Env.get('APP_NAME')}: ${[info.timestamp]}: ${info.message} ${info.stack}`
        )
      ),
    }),
  ],
  exitOnError: false,
})

logger.add(
  new transports.Console({
    format: format.combine(
      format.timestamp({ format: 'DD-MMM-YYYY HH:mm' }),
      format.align(),
      format.printf((info) => `${info.level}: ${[info.timestamp]}: ${info.message}`)
    ),
  })
)

export default logger
