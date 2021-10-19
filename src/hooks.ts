
const hooks = {}

type HookFunction = (...args: any[]) => any

export const applyHook = (name: string, data: any) => {
    const funcs = hooks[name] || []
    if (!funcs.length) return data
    return funcs.reduce((data, func) => func(data), data)
}

export const hook = (name: string, func: HookFunction) => {
    hooks[name] = hooks[name] || []
    hooks[name].push(func)
}

export const removeHook = (name: string, func:HookFunction) => {
    if (!hooks[name]) return
    const i = hooks[name].indexOf(func)
    if (i > -1) hooks[name].splice(i, 1)
}