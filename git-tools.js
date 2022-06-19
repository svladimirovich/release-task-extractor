const Git = require("nodegit");

function formatSha(sha) {
    return sha; //sha.slice(0,7);
}

function formatDate(date) {
    return date.toISOString().slice(0,16).replace("T"," ");
}

function formatMessage(message) {
    return String(message).trim();
}

async function extractCommitInfo(commit) {
    const author = commit.author();
    const sha = formatSha(commit.sha());
    const date = formatDate(commit.date())
    const message = formatMessage(commit.message());
    const parents = (await commit.getParents()).map(commit => formatSha(commit.sha()));
    return {
        sha,
        parents,
        date,
        author: {
            name: author.name(),
            email: author.email(),
        },
        message,
    }
}

function readHistory(history) {
    return new Promise(resolve => {
        history.on("end", commits => {
            resolve(commits);
        });
        history.start()
    });
}


async function openRepository(repoPath) {

    const repo = await Git.Repository.open(repoPath);

    async function getLatestCommit(branchName) {
        let commit = null;
        if (branchName == '.') {
            const branch = await repo.getCurrentBranch();
            commit = await repo.getBranchCommit(branch.shorthand());
        } else if (branchName && typeof(branchName) === 'string') {
            commit = await repo.getBranchCommit(branchName);
        } else {
            commit = await repo.getMasterCommit();
        }
        return commit;
    }

    function getCommitByTagName(tagName) {
        return Git.Reference.lookup(repo, `refs/tags/${tagName}`)
            .then(ref => ref.peel(Git.Object.TYPE.COMMIT))
            .then(ref => Git.Commit.lookup(repo, ref.id()));
    }

    async function getShaByTag(tagName) {
        const commit = await getCommitByTagName(tagName);
        return formatSha(commit.sha());
    }

    async function extractCommits(branchName) {
        const commit = await getLatestCommit(branchName);
        const history = commit.history();
        const commits = await readHistory(history);
        return Promise.all(commits.map(extractCommitInfo));
    }    
    
    return {
        extractCommits,
        getShaByTag,
    }
}

module.exports = {
    openRepository,
};
