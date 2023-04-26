import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './ogg.js'
import { openai } from './openai.js'

const INITIAL_SESSION = {
    messages: [],
}

const bot = new Telegraf(config.get('tg_token'))

bot.use(session())

bot.command('new', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Вы можете задать вопрос как текстом так и голосом...')
})

bot.command('start', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Вы можете задать вопрос как текстом так и голосом...')
})

bot.on(message('voice'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION  // Новый оператор. Применяется когда в session приходит undefined или null
    try {
        await ctx.reply(code('Сообщение принято. Жду ответ от Сервера...'))
        const link =  await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const userId = String(ctx.message.from.id)
        const oggPath = await ogg.create(link.href, userId)
        const mp3Path = await ogg.toMp3(oggPath, userId)


        const text = await openai.transcription(mp3Path)
        await ctx.reply(code(`Ваш запрос: ${text}`))

        ctx.session.messages.push({role: openai.roles.USER, content: text})

        const response = await openai.chat(ctx.session.messages)

        ctx.session.messages.push({
            role: openai.roles.ASSISTANT,
            content: response.content})

        await ctx.reply(response.content)
    } catch (e) {
        console.log(`Error while voice message`, e.message)
    }
})
////текст
bot.on(message('text'), async (ctx) => {
    ctx.session ??= INITIAL_SESSION  // Новый оператор. Применяется когда в session приходит undefined или null
    try {
        await ctx.reply(code('Сообщение принято. Жду ответ от Сервера...'))
        ctx.session.messages.push({
            role: openai.roles.USER,
            content: ctx.message.text
        })

        const response = await openai.chat(ctx.session.messages)

        ctx.session.messages.push({
            role: openai.roles.ASSISTANT,
            content: response.content})

        await ctx.reply(response.content)
    } catch (e) {
        console.log(`Error while voice message`, e.message)
    }
})


bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
