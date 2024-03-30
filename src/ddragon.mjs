import versions from "./versions.mjs"
import utils from "./utils.mjs"

const ddragon_components = {
    augments:  'augments',
    champions: 'champion',
    items:     'item',
    traits:    'trait',
}

const fetch_ddragon = async ([key, component]) => {
    try {
        const result = await fetch(`https://ddragon.leagueoflegends.com/cdn/${versions.ddragon}/data/en_US/tft-${component}.json`)
        const { data } = await result.json()
        return {
            [key]: Object.keys(data).map(id => {
                const id_components = id.split("/")
                return id_components[id_components.length - 1]
            })
        }
    } catch {
        throw new Error(`Fetching data dragon data failed: ${component}`)
    }
}

const ddragon = utils.combine_objects(
    await Promise.all(
        Object.entries(ddragon_components).map(fetch_ddragon)
    )
)

export {
    ddragon,
}

export default ddragon
