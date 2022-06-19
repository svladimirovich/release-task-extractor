const axios = require('axios');

function client({ host, user, password }) {
    const jiraApi = axios.create({
        baseURL: `https://${host}/rest/api/latest`,
        headers: {
            'Accept': 'application/json'
        },
        auth: {
            username: user,
            password: password
        }
    });

    function getProjects() {
        return jiraApi.get('/project').then(result => {
            return result.data;
        });
    }
    
    function getTask(taskId) {
        return jiraApi.get(`/issue/${taskId}`).then(result => {
            return result.data;
        });
    }

    return {
        getProjects,
        getTask,
    }
}

module.exports = {
    client,
}