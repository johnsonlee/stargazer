import _ from 'lodash'

const API = 'https://api.github.com'

export default {

    async isValidToken(token) {
        return fetch('https://api.github.com/', {
            method: 'HEAD',
            headers: new Headers({
                'Authorization': `token ${token}`,
            }),
        }).then(resp => resp.status);
    },

    async fetchRepository(path, token) {
        const repo = path.replace(/^\//g, '');
        if (-1 === repo.indexOf('/')) {
            return Promise.resolve();
        }

        console.log(`Fetching the properties of repository \`${repo}\``);
        return fetch(`${API}/repos/${repo}`, {
            method: 'GET',
            headers: new Headers({
                'Accept': 'application/vnd.github.v3.star+json',
                'Authorization': `token ${token}`,
            }),
        }).then(resp => resp.json());
    },

    async fetchStargazers(path, token) {
        const repo = path.replace(/^\//g, '');
        if (-1 === repo.indexOf('/')) {
            return Promise.resolve();
        }

        console.log(`Fetching the stargazers of repository \`${repo}\``);
        const api = `${API}/repos/${repo}/stargazers`;
        const links = await fetch(api, {
            method: 'HEAD',
            headers: new Headers({
                'Authorization': `token ${token}`,
            })
        }).then(resp => resp.headers.get('Link'));
        const n = links ? parseInt(_.last(_.last(links.split(/\s*,\s*/)).match(/page=\d+/)[0].split('='))) : 1;

        return Promise.all(_.map(_.range(1, n + 1), i => {
            return fetch(`${api}&page=${i}`, {
                method: 'GET',
                headers: new Headers({
                   'Accept': 'application/vnd.github.v3.star+json',
                   'Authorization': `token ${token}`,
                })
            }).then(resp => resp.json())
        })).then(results => _.flatten(results));
    }

}
