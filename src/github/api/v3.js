import _ from 'lodash'

const API = 'https://api.github.com'

export default {

    async fetchRepository(path, token) {
        const repo = path.replace(/^\//g, '');
        if (-1 === repo.indexOf('/')) {
            return Promise.resolve();
        }

        console.log(`Fetching the properties of repository \`${repo}\``);
        return fetch(`${API}/repos/${repo}?access_token=${token}`, {
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
        const api = `${API}/repos/${repo}/stargazers?access_token=${token}`;
        const links = await fetch(api, {
            method: 'HEAD'
        }).then(resp => resp.headers.get('Link'));
        const n = parseInt(_.last(_.last(links.split(/\s*,\s*/)).match(/page=\d+/)[0].split('=')));

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
