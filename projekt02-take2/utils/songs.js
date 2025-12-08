var APs = [];
var FCs = [];

const { default: data } = await import("./songs.json", {
    with: {
        type: "json",
    },
});

const { default: maxDiffs } = await import("./max_diffs.json", {
    with: {
        type: "json",
    },
});

export function getData() {
    return data;
}

export function getOrderedLevelTable() {
    const levelTable = data.flatMap(song => {
        const { lvlTab, lvlDiffs, ...songData } = song;
        return lvlTab.map((lvl, index) => ({
            ...songData,
            lvl,
            difficulty: lvlDiffs[index]
        }));
    });

    return levelTable.sort((a, b) => b.lvl - a.lvl);
}

export function calcSongRating(game, lvl) {
    const maxLevel = maxDiffs[game];

    if (maxLevel === undefined) {
        console.warn(`Unknown game: ${game}. Returning original level.`);
        return lvl;
    }

    if (maxLevel === 0) {
        console.warn(`Max level for game ${game} is 0. Returning 0.`);
        return 0;
    }

    return (lvl / maxLevel) * 10.0;
}

// only full table setters because the table gets pushed to EJS so it dosen't get lost and it's easier to edit this way
export function setAPs(tab) {
    APs = Array.isArray(tab) ? tab : (tab ? [tab] : []);
    console.table(APs)
}

export function setFCs(tab) {
    FCs = Array.isArray(tab) ? tab : (tab ? [tab] : []);
    console.table(FCs)
}

export function getAPs() {
    return APs;
}

export function getFCs() {
    return FCs;
}

export function validateAndSetWeighedTabs(apIds, fcIds, len) {
    let errors = [];

    apIds = Array.isArray(apIds) ? apIds : (apIds ? [apIds] : []);
    fcIds = Array.isArray(fcIds) ? fcIds : (fcIds ? [fcIds] : []);

    fcIds = fcIds.filter(id => !apIds.includes(String(id)));

    if (apIds.some(id => id > len) || fcIds.some(id => id > len)) {

        errors.push("Checkbox ID outside of bounds");
    }

    if (errors.length == 0) {
        setAPs(apIds);
        setFCs(fcIds);
    }

    return errors;
}

export default {
    getData,
    getOrderedLevelTable,
    setAPs,
    setFCs,
    getAPs,
    getFCs,
    calcSongRating,
    validateAndSetWeighedTabs
}
