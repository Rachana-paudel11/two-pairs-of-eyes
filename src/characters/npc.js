// Any supervisor is data: a name, a behaviour mode, and a line of dialogue.
// A future "Priya" is just a different stop.supervisor object - no new code.
export function createNpc(supervisorData) {
  const { name, behaviour, dialogue } = supervisorData;
  return {
    name,
    behaviour,
    dialogue,
    isDismissive: behaviour === 'dismissive',
    isCorrect: behaviour === 'correct',
    isUncertain: behaviour === 'uncertain'
  };
}
