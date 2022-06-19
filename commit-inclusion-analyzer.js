function excludeCommitsDownToSpecificSha(commitInfoArray, targetSha) {

    let targetCommit = null;
    let excludedCommits = {};
    // All commits that start with targetSha and flow into it
    // will be excluded from the list
    for (let i = 0; i < commitInfoArray.length; i++) {
        let commit = commitInfoArray[i];
        if (targetCommit == null) {
            if (commit.sha.startsWith(targetSha)) {
                targetCommit = commit;
                excludedCommits[commit.sha] = true;
                commit.parents.forEach(parentSha => excludedCommits[parentSha] = true);   
            }
        } else {
            if (excludedCommits[commit.sha]) {
                commit.parents.forEach(parentSha => excludedCommits[parentSha] = true);   
            }
        }
    }

    return commitInfoArray.filter(commit => !excludedCommits[commit.sha]);
}

module.exports = {
    excludeCommitsDownToSpecificSha,
}
