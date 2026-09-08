const test = require('node:test')
const assert = require('node:assert/strict')
const Runtime = require('../src/agent/runtime')
const SessionMemory = require('../src/agent/memory/session_memory')

const definitions = new Map([
    ['navigate', { name: 'navigate', type: 'action', description: 'Navigate', parameters: {} }],
    ['self.getPosition', {
        name: 'self.getPosition', type: 'query', description: 'Position', parameters: {}
    }]
])
const toolRegistry = {
    getAllTools: () => [...definitions.values()],
    getToolDefinition: name => definitions.get(name)
}

function toolCall(id, name, parameters) {
    return {
        type: 'tool_call',
        id,
        name,
        parameters,
        assistantMessage: {
            role: 'assistant',
            content: '',
            tool_calls: [{
                id,
                type: 'function',
                function: { name, arguments: JSON.stringify(parameters) }
            }]
        }
    }
}

function textResponse(text) {
    return {
        type: 'text',
        text,
        assistantMessage: { role: 'assistant', content: text }
    }
}

function setup(responses, results = [], options = {}) {
    const memory = new SessionMemory()
    const modelMessages = []
    const executions = []
    let responseIndex = 0
    let resultIndex = 0
    const runtime = new Runtime({
        modelClient: {
            chat: async messages => {
                modelMessages.push(structuredClone(messages))
                return responses[responseIndex++]
            }
        },
        toolRegistry,
        aiInterface: {
            handle: async request => {
                executions.push(request)
                return results[resultIndex++] ?? { success: true, data: {} }
            }
        },
        sessionMemory: memory,
        ...options
    })
    return { runtime, memory, modelMessages, executions }
}

test('loops across tools and commits the whole task as one Session turn', async () => {
    const s = setup([
        toolCall('q1', 'self.getPosition', {}),
        toolCall('a1', 'navigate', { position: { x: 10, y: 64, z: 20 } }),
        textResponse('已经移动到目标位置。')
    ], [
        { success: true, data: { x: 0, y: 64, z: 0 } },
        { success: true, data: { arrived: true } }
    ])

    const result = await s.runtime.run('去目标位置')
    assert.equal(result.success, true)
    assert.equal(result.agentOutput, '已经移动到目标位置。')
    assert.deepEqual(result.toolResult, { success: true, data: { arrived: true } })
    assert.equal(result.task.iteration, 3)
    assert.deepEqual(s.modelMessages.map(messages => messages.at(-1).role), [
        'user', 'tool', 'tool'
    ])
    assert.equal(s.modelMessages.every(messages =>
        messages.filter(message => message.role === 'system').length === 1
    ), true)
    assert.equal(s.memory.turns.length, 1)
    assert.deepEqual(s.memory.getMessages().map(message => message.role), [
        'user', 'assistant', 'tool', 'assistant', 'tool', 'assistant'
    ])
    assert.equal(s.memory.getMessages().some(message => message.role === 'system'), false)
})

test('a failed Tool result is an observation and the model can finish with text', async () => {
    const failed = { success: false, reason: 'NAVIGATION_FAILED', data: null }
    const s = setup([
        toolCall('a1', 'navigate', { position: { x: 10, y: 64, z: 20 } }),
        textResponse('无法到达目标位置。')
    ], [failed])

    const result = await s.runtime.run('去目标位置')
    assert.equal(result.success, true)
    assert.equal(result.task.status, 'finished')
    assert.equal(result.agentOutput, '无法到达目标位置。')
    assert.deepEqual(result.toolResult, failed)
    assert.equal(s.modelMessages.length, 2)
})

test('iteration budget stops the loop and preserves completed Tool pairs', async () => {
    const s = setup([
        toolCall('q1', 'self.getPosition', {}),
        toolCall('a1', 'navigate', { position: { x: 1, y: 64, z: 1 } })
    ], [], { maxIterations: 2 })

    const result = await s.runtime.run('持续执行')
    assert.equal(result.reason, 'AGENT_BUDGET_EXCEEDED')
    assert.equal(result.task.status, 'failed')
    assert.equal(result.task.iteration, 2)
    assert.equal(s.memory.turns.length, 1)
    assert.equal(s.memory.getMessages().at(-1).role, 'tool')
})

test('three identical Tool, parameters and results trigger no-progress protection', async () => {
    const call = index => toolCall(`q${index}`, 'self.getPosition', {})
    const sameResult = { success: true, data: { x: 0, y: 64, z: 0 } }
    const s = setup([call(1), call(2), call(3)], [sameResult, sameResult, sameResult])

    const result = await s.runtime.run('重复查询')
    assert.equal(result.reason, 'AGENT_NO_PROGRESS')
    assert.equal(result.task.iteration, 3)
    assert.deepEqual(result.toolResult, sameResult)
    assert.equal(s.memory.turns.length, 1)
    assert.equal(s.memory.getMessages().at(-1).role, 'tool')
})

test('timeout before a completed exchange does not commit a user-only turn', async () => {
    const s = setup([], [], { maxDurationMs: 0 })
    const result = await s.runtime.run('超时')
    assert.equal(result.reason, 'AGENT_TIMEOUT')
    assert.equal(result.task.iteration, 0)
    assert.equal(s.memory.turns.length, 0)
})

test('injects one Minecraft system prompt per task without storing it in Session', async () => {
    const s = setup([
        textResponse('你好。'),
        textResponse('又见面了。')
    ])

    await s.runtime.run('你好')
    await s.runtime.run('还记得我吗')

    for (const messages of s.modelMessages) {
        assert.equal(messages[0].role, 'system')
        assert.match(messages[0].content, /Minecraft/)
        assert.match(messages[0].content, /one or two short sentences/)
        assert.equal(messages.filter(message => message.role === 'system').length, 1)
    }
    assert.deepEqual(s.modelMessages[1].map(message => message.role), [
        'system', 'user', 'assistant', 'user'
    ])
    assert.equal(s.memory.turns.length, 2)
    assert.equal(s.memory.getMessages().some(message => message.role === 'system'), false)
})
