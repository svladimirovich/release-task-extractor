const Git = require("nodegit");
const commandLineArgs = require('command-line-args');

const commandLineDefinitions = [
    {
        name: 'repository',
        alias: 'r',
        type: String,
    },
    {
        name: 'final-tag',
        alias: 't',
        type: String,
    },
    {
        name: 'jira-user',
        alias: 'u',
        type: String,
    },
    {
        name: 'jira-password',
        alias: 'p',
        type: String
    },
    {
        name: 'jira-host',
        alias: 'h',
        type: String
    }
    // { name: 'target', alias: 'v', type: Boolean },
    // { name: 'src', type: String, multiple: true, defaultOption: true },
    // { name: 'timeout', alias: 't', type: Number }
];

const options = commandLineArgs(commandLineDefinitions);
console.log("running task extractor with options", options);

const jira = require('./jira.js').client({
    host: options["jira-host"],
    user: options["jira-user"],
    password: options["jira-password"],
});

const targetRepository = options["repository"];
const targetTag = options["final-tag"];

function getProjectKeys() {
    return jira.getProjects().then(projects => {
        return projects.map(p => p.key);
    });
}

if (!targetRepository) {
    console.log("Please specify a repository");
    process.exit();
}

void async function main() {
    console.log("step", 0);
    const projectKeys = await getProjectKeys();
    console.log("step", 1);
    const taskPattern = new RegExp(`(${projectKeys.join('|')})[-_\\s]?(\\d+)`, 'gmi');

    function getCommitByTagName(repo, tagName) {
        return Git.Reference.lookup(repo, `refs/tags/${tagName}`)
            .then(ref => ref.peel(Git.Object.TYPE.COMMIT))
            .then(ref => Git.Commit.lookup(repo, ref.id()));
    }

    function extractCommitInfo(commit) {
        const author = commit.author();
        const sha = commit.sha().slice(0,8);
        const date = commit.date().toISOString().slice(0,16).replace("T"," ");
        const message = String(commit.message()).trim();
        return {
            sha,
            date,
            author: {
                name: author.name(),
                email: author.email(),
            },
            message,
        }
    }
    
    function extractTicketName(commitMessage, pattern) {
        const regex = pattern;
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

    async function enrichWithTaskInfoFromJira(ticketId, task) {
        let taskInfo = null;
        try {
            taskInfo = await jira.getTask(ticketId)
        } catch (error) {
            console.error("error requesting info for task:", ticketId);
            return task;
        }

        Object.assign(task, {
            taskId: ticketId,
            creator: taskInfo?.fields?.creator?.displayName,
            assignee: taskInfo?.fields?.assignee?.displayName,
            status: taskInfo?.fields?.status?.name,
            issuetype: taskInfo?.fields?.issuetype?.name,
            project: taskInfo?.fields?.project?.name,
            summary: taskInfo?.fields?.summary,   
        });

        return task;
    }

    const repo = await Git.Repository.open(targetRepository);
    console.log("step", 2);

    const targetCommit = await getCommitByTagName(repo, targetTag);
    console.log("step", 3);

    const tag_oid = targetCommit.id();

    const branch = await repo.getCurrentBranch();
    console.log("step", 4);

    const commit = await repo.getBranchCommit(branch.shorthand());
    console.log("step", 5);

    const history = commit.history();
    let isDone = false;
    let tasks = {};
    history.on("commit", async commit => {
        if (commit.id().equal(tag_oid)) {
            // target tag is reached
            isDone = true;
            for(let key in tasks) {
                tasks[key] = await enrichWithTaskInfoFromJira(key, tasks[key]);
                console.log(`${key} - ${tasks[key].summary}`);
            }
            wrapUp(tasks);
        } else if (!isDone) {
            const tickets = extractTicketName(commit.message(), taskPattern);
            tickets.forEach(ticket => {
                if (!tasks[ticket]) {
                    tasks[ticket] = {
                        commits: []
                    };
                }
                tasks[ticket].commits.push(extractCommitInfo(commit));
            });
        }
    });
    history.start();

    function wrapUp(tasks) {
        // TODO: maybe save result into some json file?
    }
}();

