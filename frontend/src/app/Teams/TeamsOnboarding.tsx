import React, { useState, useContext, useEffect } from 'react';
import { createTeam, createRepository, listJiraProjects, checkGithubRepository } from "@app/utils/APIService";
import {
  Wizard, PageSection, PageSectionVariants,
  TextInput, FormGroup, Form, TextArea,
  DescriptionList, DescriptionListGroup, DescriptionListDescription, DescriptionListTerm, Title, Spinner,
  Alert, AlertGroup, AlertVariant, Button, Toolbar, ToolbarContent, ToolbarItem, ToolbarGroup,
  DualListSelector
} from '@patternfly/react-core';
import { useHistory } from 'react-router-dom';
import { getTeams } from '@app/utils/APIService';
import { PlusIcon } from '@patternfly/react-icons/dist/esm/icons';
import { ReactReduxContext } from 'react-redux';
import { TeamsTable } from './TeamsTable';

export interface AlertInfo {
  title: string;
  variant: AlertVariant;
  key: string;
}

export const githubRegExp = new RegExp('https:\/\/github\.com\/[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+')

export const TeamsWizard = () => {
  const { store } = useContext(ReactReduxContext);
  const state = store.getState();
  const dispatch = store.dispatch;

  const [stepIdReached, setState] = useState<string>("team");
  const [newTeamName, setNewTeamName] = useState<string>("");
  const [newTeamDesc, setNewTeamDesc] = useState<string>("");
  const [newRepoName, setNewRepoName] = useState<string>("");
  const [newOrgName, setNewOrgName] = useState<string>("");
  const [creationLoading, setCreationLoading] = useState<boolean>(false);
  const [alerts, setAlerts] = React.useState<AlertInfo[]>([]);
  const [creationError, setCreationError] = useState<boolean>(false);
  const [isFinishedWizard, setIsFinishedWizard] = useState<boolean>(false);
  const [isOpen, setOpen] = useState<boolean>(false);
  const history = useHistory();
  const params = new URLSearchParams(window.location.search);
  const open = params.get('isOpen');
  const [jiraProjects, setJiraProjects] = useState<Array<string>>([])
  const [githubUrl, setGithubUrl] = useState<string>("");
  type validate = 'success' | 'warning' | 'error' | 'default';
  const [githubUrlValidated, setGithubUrlValidated] = React.useState<validate>();

  const onSubmit = async () => {
    // Create a team
    setIsFinishedWizard(true)
    setCreationLoading(true)
    const data = {
      "team_name": newTeamName,
      "description": newTeamDesc,
      "jira_keys": jiraProjects.join(",")
    }

    createTeam(data).then(response => {
      if (response.code == 200) {
        setAlerts(prevAlertInfo => [...prevAlertInfo, {
          title: 'Team created',
          variant: AlertVariant.success,
          key: "team-created"
        }]);
      } else {
        setAlerts(prevAlertInfo => [...prevAlertInfo, {
          title: 'Could not create new team',
          variant: AlertVariant.danger,
          key: "team-not-created"
        }]);
        setCreationError(true)
      }
    }).catch(error => {
      console.log("NEW TEAM", data);
      console.log(error);
    })


    // Create a repo optionally (only if fields are populated)
    if (newRepoName != "" && newOrgName != "") {
      try {
        const data = {
          git_organization: newOrgName,
          repository_name: newRepoName,
          jobs: {
            github_actions: {
              monitor: false
            }
          },
          artifacts: [],
          team_name: newTeamName
        }
        const response = await createRepository(data)
        if (response.code == 200) {
          setAlerts(prevAlertInfo => [...prevAlertInfo, {
            title: 'Repository created',
            variant: AlertVariant.success,
            key: "repo-created"
          }]);
        } else {
          setAlerts(prevAlertInfo => [...prevAlertInfo, {
            title: 'Could not add repository',
            variant: AlertVariant.danger,
            key: "repo-not-created"
          }]);
          setCreationError(true)
        }
      }
      catch (error) {
        console.log(error)
      }
    }

    setCreationLoading(false)
    if (!creationError) {
      setAlerts(prevAlertInfo => [...prevAlertInfo, {
        title: 'You resources have created successfully. You can close the modal now.',
        variant: AlertVariant.info,
        key: "all-created"
      }]);
      getTeams().then(data => {
        if (data.data.length > 0) {
          dispatch({ type: "SET_TEAM", data: newTeamName });
          dispatch({ type: "SET_TEAMS_AVAILABLE", data: data.data });
        }
      })
    }

  };

  const onNext = (id) => {
    setState(id.id);
  };

  const onBack = (id) => {
    setState(id.id);
  };

  const onClear = () => {
    setOpen(false)
    setNewTeamName("")
    setNewTeamDesc("")
    setNewOrgName("")
    setNewRepoName("")
    history.push("/home/teams")
    window.location.reload();
  };

  const TeamData = (
    <div className={'pf-u-m-lg'} >
      <Form>
        <FormGroup label="Team Name" isRequired fieldId="team-name" helperText="Include the name for your team">
          <TextInput value={newTeamName} type="text" onChange={(value) => { setNewTeamName(value) }} aria-label="text input example" placeholder="Include the name for your team" />
        </FormGroup>
        <FormGroup label="Description" isRequired fieldId='team-description' helperText="Include a description for your team">
          <TextArea value={newTeamDesc} type="text" onChange={(value) => { setNewTeamDesc(value) }} aria-label="text area example" placeholder="Include a description for your team" />
        </FormGroup>
      </Form>
    </div>
  )

  const handleGithub = async (value: string) => {
    setGithubUrl(value);
    setGithubUrlValidated('error');

    // check that matchesgithubRegExp
    if (githubRegExp.test(value)) {
      // check that gh repo exists
      const repo = value.replace("https://github.com/", "").split("/")

      await checkGithubRepository(repo[0], repo[1]).then((data: any) => {
        if (data != undefined && data.code == 200) {
          setGithubUrlValidated('success');
          // save repo and org
          setNewOrgName(repo[0]);
          setNewRepoName(repo[1]);
        }
      })
    } else {
      setGithubUrlValidated('error');
    }
  };

  const AddRepo = (
    <div className={'pf-u-m-lg'} >
      <Title style={{ marginBottom: '20px' }} headingLevel="h6" size="xl">Optionally: add a GitHub repository to your team</Title>
      <Form>
        <FormGroup label="GitHub Repository URL" fieldId="repo-name">
          <TextInput validated={githubUrlValidated} value={githubUrl} type="text" onChange={handleGithub} aria-label="text input example" placeholder="Add a GitHub repository" />
        </FormGroup>
      </Form>
    </div>
  )

  const DataReview = (
    <div>
      <Title headingLevel="h6" size="xl">Review your data</Title>
      <div style={{ marginTop: '2em' }}>
        <DescriptionList isHorizontal>
          <DescriptionListGroup>
            <DescriptionListTerm>Name</DescriptionListTerm>
            <DescriptionListDescription>{newTeamName}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Description</DescriptionListTerm>
            <DescriptionListDescription>{newTeamDesc}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>GitHub Repository</DescriptionListTerm>
            <DescriptionListDescription>{githubUrl}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Jira Projects</DescriptionListTerm>
            <DescriptionListDescription>{jiraProjects.join(" - ")}</DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
      </div>
      <div style={{ marginTop: "2em" }}>
        {creationLoading && <Spinner isSVG aria-label="Contents of the basic example" />}
        <AlertGroup isLiveRegion aria-live="polite" aria-relevant="additions text" aria-atomic="false">
          {alerts.map(({ title, variant, key }) => (
            <Alert variant={variant} isInline isPlain title={title} key={key} />
          ))}
        </AlertGroup>
      </div>
    </div>
  )

  const ValidateTeam = () => { return newTeamName != "" && newTeamDesc != "" }

  const ValidateRepoAndOrg = () => {
    if (newRepoName != "" || newOrgName != "") {
      return newRepoName != "" && newOrgName != ""
    }
    else if (newRepoName == "" && newOrgName == "") {
      return true
    }
    return false

  }

  const jiraOnChange = (options: Array<string>) => {
    setJiraProjects(options)
  }

  const steps = [
    { id: 'team', name: 'Team Name', component: TeamData, enableNext: ValidateTeam() },
    { id: 'repo', name: 'Add a GitHub repository', component: AddRepo, canJumpTo: ValidateTeam(), enableNext: ValidateRepoAndOrg() },
    { id: 'jira', name: 'Jira Projects', component: JiraProjects({ onChange: jiraOnChange, teamJiraKeys: "" }), canJumpTo: ValidateTeam(), enableNext: ValidateTeam() },
    {
      id: 'review',
      name: 'Review',
      component: DataReview,
      nextButtonText: 'Create',
      canJumpTo: (ValidateTeam() && ValidateRepoAndOrg()),
      hideCancelButton: true,
      isFinishedStep: isFinishedWizard
    }
  ];

  const title = 'Create new Team';

  const handleModalToggle = () => {
    setOpen(!isOpen)
  };

  useEffect(() => {
    if (open == "true") {
      setOpen(true)
    }
  }, []);

  return (
    <React.Fragment>
      <PageSection style={{ backgroundColor: 'white' }} variant={PageSectionVariants.light}>
        <Toolbar id="toolbar-items">
          <ToolbarContent>
            <ToolbarGroup variant="filter-group" alignment={{ default: 'alignLeft' }}>
              <Title headingLevel="h2" size="3xl">Teams</Title>
            </ToolbarGroup>
            <ToolbarGroup variant="filter-group" alignment={{ default: 'alignRight' }}>
              <ToolbarItem>
                <Button onClick={handleModalToggle} type="button" variant="primary"> <PlusIcon></PlusIcon> Add Team </Button>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
        <TeamsTable></TeamsTable>
        <Wizard
          steps={steps}
          onNext={onNext}
          onBack={onBack}
          onClose={onClear}
          onSave={onSubmit}
          cancelButtonText="Close"
          height={600}
          title={title}
          description="Create a new team and (optionally) add a new repository"
          isOpen={isOpen}
          hideClose={false}
        />
      </PageSection>
    </React.Fragment>
  );
}

const exists = (teamJiraKeys: string | undefined, projectKey: string) => {
  if (teamJiraKeys != undefined &&
    teamJiraKeys.split(",").find(key => projectKey == key)) {
    return true
  }

  return false
}

export const JiraProjects: React.FC<{ onChange: (options: Array<string>) => void, default?: Array<string>, teamJiraKeys: string | undefined }> = (props) => {
  const [availableOptions, setAvailableOptions] = React.useState<React.ReactNode[]>([]);
  const [chosenOptions, setChosenOptions] = React.useState<React.ReactNode[]>([])

  const onListChange = (newAvailableOptions: React.ReactNode[], newChosenOptions: React.ReactNode[]) => {
    setAvailableOptions(newAvailableOptions);
    setChosenOptions(newChosenOptions);
  };

  const available = new Array<React.ReactNode>;
  const chosen = new Array<React.ReactNode>;

  useEffect(() => {
    listJiraProjects().then((res) => { // making the api call here
      if (res.code === 200) {
        const result = res.data;
        result.map(el => {
          const option = <span key={el.project_key}>{el.project_name + " (" + el.project_key + ")"}</span>

          // only display available options that are not already selected
          if (!exists(props.teamJiraKeys, el.project_key)) {
            available.push(option)
          }

          // display the jira keys that are already attached to the team
          if (chosenOptions.length == 0 &&
            props.teamJiraKeys != undefined &&
            props.teamJiraKeys.split(",").find(key => el.project_key == key)) {
            chosen.push(option)
          }
        })
        setAvailableOptions(available)
        setChosenOptions(chosen)
      }
    });
  }, []);


  function filterOption(option: React.ReactNode, input: string) {
    return (option as React.ReactElement).props.children.toLowerCase().includes(input.toLowerCase())
  }

  useEffect(() => {
    props.onChange(chosenOptions.map(o => { if (o) return o["key"] }))
  }, [chosenOptions]);

  return (
    <React.Fragment>
      <Title headingLevel='h4'>Select Jira Projects</Title>
      <p style={{ marginBottom: '10px' }}>The Jira Projects you select will be associated to the created Team. The projects will be used to gather and display metrics about bugs in the Jira page.</p>
      <DualListSelector
        isSearchable
        availableOptions={availableOptions}
        chosenOptions={chosenOptions}
        addAll={onListChange}
        removeAll={onListChange}
        addSelected={onListChange}
        removeSelected={onListChange}
        filterOption={filterOption}
        id="dual-list-selector-complex"
      />
    </React.Fragment>
  );
};
