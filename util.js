/**
 * Group 2 objects into 1 object
 *
 * @param {Object} a - the first object
 * @param {Object} b - the second object
 *
 * @returns {Object} - grouped object
 */
function group_objects(a, b) {
    if(!(a instanceof Object && b instanceof Object))
        throw new Error("`group_objects`: calling with non-objects")

    return {
        ...a,
        ...b,
    }
}

/**
 * Turn an object array into a mapped objects with key provided in the object
 *
 * @param {Array} arr - the object array
 * @param {*} key - the key provided in the object to identify the object
 *
 * @returns {Object} - the transformed mapped objects
 */
function map_objects_with_key(arr, key) {
    let objects = {}

    for(const object of arr) {
        objects = group_objects(
            objects,
            { [object[key]]: object }
        )
    }

    return objects
}

/**
 * Transform object keys
 *
 * @param {Object} object - the target object
 * @param {Function} shift_key_fn - the function to shift the current key
 *
 * @returns {Object} - the transformed object with new keys
 */
function shift_object_keys(object, shift_key_fn) {
    let transformed_object = {}

    for(const [key, value] of Object.entries(object)) {
        transformed_object = group_objects(
            transformed_object,
            { [shift_key_fn(key)]: value }
        )
    }

    return transformed_object
}

/**
 * Check if a variable is undefined or null
 *
 * @param {*} value - the variable to be checked
 *
 * @returns {boolean} - telling the variable is undefined or null
 */
function is_absent(value) {
    return value === undefined || value === null
}

/**
 * Truncate a precise number into a readable number
 *
 * @param {number} num - the target precise number
 *
 * @returns {number} - truncated number
 */
function truncate_number(num) {
    if(!Number.isFinite(num))
        return num

    if(-1 < num && num < 1)
        return num.toFixed(2)

    return Math.trunc(num)
}

export {
    group_objects,
    map_objects_with_key,
    shift_object_keys,
    is_absent,
    truncate_number,
}

export default {
    group_objects,
    map_objects_with_key,
    shift_object_keys,
    is_absent,
    truncate_number,
}
