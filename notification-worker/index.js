import { WorkerEntrypoint } from 'cloudflare:workers';

// Called only through the private Pages service binding. HTTP cannot send email.
export default class TourNotifications extends WorkerEntrypoint {
  async notify(message) {
    if (typeof message?.subject !== 'string' || message.subject.length > 300
      || /[\r\n]/.test(message.subject) || typeof message.text !== 'string'
      || message.text.length > 3000) throw new Error('Invalid notification');
    return await this.env.EMAIL.send({
      from: { name: 'GetFlexSpace', email: 'notifications@getflexspace.com' },
      to: 'jim@rothcapital.com',
      subject: message.subject,
      text: message.text,
    });
  }

  fetch() { return new Response('Not found', { status: 404 }); }
}
