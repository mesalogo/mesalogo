import StartNode from './StartNode';
import EndNode from './EndNode';
import AgentNode from './AgentNode';
import TaskNode from './TaskNode';
import KnowledgeNode from './KnowledgeNode';
import ApiNode from './ApiNode';
import ConditionNode from './ConditionNode';

export const nodeTypes = {
  start: StartNode,
  end: EndNode,
  agent: AgentNode,
  task: TaskNode,
  knowledge: KnowledgeNode,
  api: ApiNode,
  condition: ConditionNode,
};

export {
  StartNode,
  EndNode,
  AgentNode,
  TaskNode,
  KnowledgeNode,
  ApiNode,
  ConditionNode,
};
