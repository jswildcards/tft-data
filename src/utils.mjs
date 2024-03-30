function combine_objects(arr) {
    if(!Array.isArray(arr))
        throw new Error('Calling `combine_objects` failed: not an array')

    return arr.reduce((acc, cur) => ({ ...acc, ...(cur ?? {}) }), {})
}

export {
    combine_objects,
}

export default {
    combine_objects,
}
