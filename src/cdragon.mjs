import versions from './versions.mjs'

const cdragon = await fetch(`https://raw.communitydragon.org/${versions.cdragon}/cdragon/tft/en_us.json`).
    then(result => result.json()).
    then(result => {
        const current_set = result.setData.find(set => set.mutator === versions.set)

        return {
            augments:  result.items,
            champions: current_set.champions,
            items:     result.items,
            traits:    current_set.traits,
        }
    }).catch(_ => {
        throw new Error('Fetching community dragon data failed')
    })

export {
    cdragon,
}

export default cdragon
