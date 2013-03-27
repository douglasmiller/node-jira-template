config = require('../config');
JiraApi = require('jira').JiraApi;
var url = require('url');
(function () {

    this.addGHEpicLink = function (epic, epicLink, callback) {
        var options = {
            uri: this.makeGHUri('/epics/' + epic + '/add', 'rest/greenhopper/', '1.0'),
            body: epicLink,
            method: 'PUT',
            json: true
        };

        this.request(options, function(error, response, body) {
            if (response.statusCode === 200 || response.statusCode === 204) {
                callback(null, body);
                return;
            }
            callback(response.statusCode + ': Error while adding GreenHopper Epic Link');
        });
    };

    this.makeGHUri = function(pathname, altBase, altApiVersion) {
        var basePath = 'rest/api/';
        if (altBase != null) {
            basePath = altBase;
        }
        var apiVersion = this.apiVersion;
        if (altApiVersion != null) {
            apiVersion = altApiVersion;
        }

        var uri = url.format({
            protocol: this.protocol,
            hostname: this.host,
            auth: this.username + ':' + this.password,
            port: this.port,
            pathname: basePath + apiVersion + pathname
        });
        return uri;
    };

}).call(JiraApi.prototype);

jira = new JiraApi('https', config.jira.host, config.jira.port, config.jira.user, config.jira.password, '2', true);


exports.fetch = function (req, res){
  //@TODO: deal with errors
  jira.listProjects(function (error, data) {
    if (error) {
      console.log(error);
      return;
    }
    var projects = []
      , templates = [];
    while (item = data.shift()) {
        if (item.key.substring(0, 4) == "TMPL") {
          templates.push(item);
        }
        projects.push(item);
    }
    res.render('projects', { title: 'Project Issue Transfer Tool', projects: projects, templates: templates });
  });
};


exports.transfer = function (req, res) {
  if (req.body.template === undefined || req.body.destination === undefined) {
    res.send("The Template and Desintation are required. How did you get rid of them?");
  }
  else{
    //@TODO: test with DESC 
    var query = "project='" + req.body.template + "' ORDER BY issuetype ASC";
    var options = {
      maxResults: 1000,
      fields: [
        "*all"
        //"summary", 
        //"description", 
        //"customfield_10101", 
        //"customfield_10100", 
        //"components",
        //"issuetype", 
        //"issuelinks"
      ]
    };
    //@TODO: check error status
    jira.searchJira(query, options, function (error, data) {
      if (error) {
        console.log(error);
        return;
      }
      var epics = []
        , issues = []
        , xfered = {}
        , fields = ["summary", "issuetype", "component", "customfield_10101"];
      while (item = data.issues.shift()) {
        doit(item);
      }

      function doit (item) {
        var issue = {
          "fields": {
            "project": { "key": req.body.destination},
            "description": item.fields.description ? item.fields.description : "",
          },
          "xfersource": item.key
        }
        if (item.fields.issuetype.name != "Epic"){
          if (item.fields.customfield_10100 !== undefined && xfered[item.fields.customfield_10100] === undefined) {
            setTimeout(function () {
              doit(item);
            }, 500);
            return;
          }
          else if (xfered[item.fields.customfield_10100] !== undefined) {
            //@TODO: Figure out how to set this field. It is the agile board epic
            //issue.fields.customfield_10100 = xfered[item.fields.customfield_10100].key;
          }
        }

        fields.forEach(function (field, index, array) {
          if (item.fields[field] !== undefined && item.fields[field]) {
            issue.fields[field] = item.fields[field];
          }
        });       

        //@TODO: deal with errors
        jira.addNewIssue(issue, function (error, newIssue) {
          if (error) {
            console.log(error);
            return;
          }
          xfered[issue.xfersource] = newIssue;

          if (item.fields.customfield_10100 !== undefined && item.fields.customfield_10100) {
            var epicLink = {
              "ignoreEpics": true,
              "issueKeys": [newIssue.key]
            };
            jira.addGHEpicLink(xfered[item.fields.customfield_10100].key, epicLink, function (error, data) {
              if (error) {
                console.log(error);
              }
            });
          }

          item.fields.issuelinks.forEach(function (link, index, array) {
            var remote = link.outwardIssue === undefined ? link.inwardIssue : link.outwardIssue;
            if (xfered[remote.key] !== undefined) {
              var newLink = {
                "type": link.type,
                "inwardIssue": link.inwardIssue === undefined ? newIssue : xfered[remote.key],
                "outwardIssue": link.outwardIssue === undefined ? newIssue : xfered[remote.key]
              };
              jira.issueLink(newLink, function (error, data) {
                if (error) {
                  console.log(error);
                  return;
                }
              });
            }
          });
        });
      }

    });
  }

  res.send("Issue transfer started.");

};

