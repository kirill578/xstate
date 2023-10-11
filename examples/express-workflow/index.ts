import {
  createMachine,
  createActor,
  PersistedMachineState,
  assign
} from 'xstate';
import bodyParser from 'body-parser';

function generateActorId() {
  return Math.random().toString(36).substring(2, 8);
}

const persistedStates: Record<
  string,
  PersistedMachineState<any, any, any, any, any, any>
> = {};

const machine = createMachine({
  id: 'counter',
  initial: 'green',
  context: {
    cycles: 0
  },
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: 'red'
      }
    },
    red: {
      on: {
        TIMER: {
          target: 'green',
          actions: assign({
            cycles: ({ context }) => context.cycles + 1
          })
        }
      }
    }
  }
});

import express from 'express';

const app = express();

app.use(bodyParser.json());

// Endpoint to start a new workflow instance
// - Generates a unique ID for the actor
// - Starts the actor
// - Persists the actor state
// - Returns the actor ID in the response
app.post('/workflows', (req, res) => {
  const workflowId = generateActorId(); // generate a unique ID
  const actor = createActor(machine).start();

  // @ts-ignore
  persistedStates[workflowId] = actor.getPersistedState();

  res.send({ workflowId });
});

// Endpoint to send events to an existing workflow instance
// - Gets the actor ID from request params
// - Gets the persisted state for that actor
// - Sends the event from the request body to the actor
// - Persists the updated state
// - Returns the updated state in the response
app.post('/workflows/:workflowId', (req, res) => {
  const { workflowId } = req.params;
  const snapshot = persistedStates[workflowId];

  if (!snapshot) {
    return res.status(404).send('Actor not found');
  }

  const event = req.body;
  const actor = createActor(machine, { state: snapshot }).start();

  actor.send(event);

  // @ts-ignore
  persistedStates[workflowId] = actor.getPersistedState();

  actor.stop();

  res.sendStatus(200);
});

// Endpoint to get the current state of an existing workflow instance
// - Gets the actor ID from request params
// - Gets the persisted state for that actor
// - Returns the persisted state in the response
app.get('/workflows/:workflowId', (req, res) => {
  const { workflowId } = req.params;
  const persistedState = persistedStates[workflowId];

  if (!persistedState) {
    return res.status(404).send('Actor not found');
  }

  res.json(persistedState);
});

app.get('/', (_, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif;">
        <h1>Express Workflow</h1>
        <p>Start a new workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows</pre>
        <p>Send an event to a workflow instance:</p>
        <pre>curl -X POST http://localhost:4242/workflows/:workflowId -d '{"type":"TIMER"}'</pre>
        <p>Get the current state of a workflow instance:</p>
        <pre>curl -X GET http://localhost:4242/workflows/:workflowId</pre>
      </body>
    </html>
  `);
});

app.listen(4242, () => {
  console.log('Server listening on port 4242');
});