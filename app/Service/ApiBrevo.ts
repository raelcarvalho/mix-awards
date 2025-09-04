import axios from 'axios'
import Env from '@ioc:Adonis/Core/Env'

type SendParams = {
  toEmail: string
  toName?: string
  subject: string
  html: string
  text?: string
}

export default class ApiBrevo {
  public static async send({ toEmail, toName, subject, html, text }: SendParams) {
    const payload = {
      sender: {
        name: Env.get('MAIL_FROM_NAME'),
        email: Env.get('MAIL_FROM_EMAIL'),
      },
      to: [{ email: toEmail, name: toName || toEmail }],
      subject,
      htmlContent: html,
      textContent: text || '',
    }

    await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: {
        'api-key': Env.get('BREVO_API_KEY'),
        'content-type': 'application/json',
        accept: 'application/json',
      },
      timeout: 15000,
    })
  }
}
