export function isset(variable) {
    return typeof variable !== 'undefined' && variable !== null;
}

export function increaseRating(tab, songs, songsData, rating, penalty = 0) {
    tab.forEach((id) => {
        const song = songsData.find(s => s.sd_id === id);
        if (song) {
            rating += songs.calcSongRating(song.game, song.lvl - penalty);
        }
    })

    return rating;
}

export default {
    isset,
    increaseRating
}
