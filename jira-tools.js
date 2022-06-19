const jiraApi = require('./jira-api.js');

async function create({ host, user, password }) {

    const jira = jiraApi.client({ host, user, password });

    function getProjectKeys() {
        return jira.getProjects().then(projects => {
            return projects.map(p => p.key);
        });
    }

    function getTaskInfoFromJira(ticketId) {
        return jira.getTask(ticketId).then(taskInfo => ({
            taskId: ticketId,
            creator: taskInfo?.fields?.creator?.displayName,
            assignee: taskInfo?.fields?.assignee?.displayName,
            status: taskInfo?.fields?.status?.name,
            issuetype: taskInfo?.fields?.issuetype?.name,
            project: taskInfo?.fields?.project?.name,
            summary: taskInfo?.fields?.summary,   
        }));
    }    

    const projectKeys = await getProjectKeys();
    const taskPattern = new RegExp(`(${projectKeys.join('|')})[-_\\s]?(\\d+)`, 'gmi');

    function extractTicketReferences(commitMessage) {
        const regex = taskPattern;
        let result = [];
        let m;
        while ((m = regex.exec(commitMessage)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            result.push(`${m[1].toUpperCase()}-${m[2]}`)
        }
        return result;
    }

    function extractTasksFromCommits(commitInfoArray) {
        let tasks = {};
        commitInfoArray.forEach(commit => {
            const tickets = extractTicketReferences(commit.message);
            tickets.forEach(ticket => {
                if (!tasks[ticket]) {
                    tasks[ticket] = {
                        commits: []
                    };
                }
                tasks[ticket].commits.push(commit);
            });
        });
        return tasks;
    }

    return {
        extractTasksFromCommits,
        getTaskInfoFromJira,
    };
}

module.exports = {
    create,
}
