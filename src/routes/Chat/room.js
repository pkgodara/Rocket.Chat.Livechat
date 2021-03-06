import { Livechat } from '../../api';
import { store } from '../../store';
import { route } from 'preact-router';
import { setCookies, upsert, canRenderMessage } from '../../components/helpers';
import Commands from '../../lib/commands';
import { loadConfig, processUnread } from '../../lib/main';
import { parentCall } from '../../lib/parentCall';
import { handleTranscript } from '../../lib/transcript';

const commands = new Commands();

export const closeChat = async() => {
	await handleTranscript();
	await loadConfig();
	parentCall('callback', 'chat-ended');
	route('/chat-finished');
};

const processMessage = async(message) => {
	if (message.t === 'livechat-close') {
		closeChat();
	} else if (message.t === 'command') {
		commands[message.msg] && commands[message.msg]();
	}
};

const doPlaySound = async(message) => {
	const { sound, user } = store.state;

	if (!sound.enabled || (user && message.u && message.u._id === user._id)) {
		return;
	}

	await store.setState({ sound: { ...sound, play: true } });
};

export const initRoom = async() => {
	const { state } = store;
	const { room, config: { settings: { showConnecting } } = {} } = state;

	if (!room) {
		return;
	}

	Livechat.unsubscribeAll();

	const { token, agent, room: { _id: rid, servedBy } } = state;
	Livechat.subscribeRoom(rid);

	let roomAgent = agent;
	if (!roomAgent) {
		if (servedBy) {
			roomAgent = await Livechat.agent({ rid });
			store.setState({ roomAgent });
			await store.setState({ agent: roomAgent });
		}
		const connecting = !!(!roomAgent && showConnecting);
		store.setState({ connecting });
	}

	Livechat.onAgentChange(rid, (agent) => {
		store.setState({ agent });
	});

	Livechat.onAgentStatusChange(rid, (status) => {
		const { agent } = store.state;
		agent && store.setState({ agent: { ...agent, status } });
	});

	setCookies(rid, token);
	parentCall('callback', 'chat-started');
};

Livechat.onTyping((username, isTyping) => {
	const { typing, user } = store.state;

	if (user && user.username && user.username === username) {
		return;
	}

	if (typing.indexOf(username) === -1 && isTyping) {
		typing.push(username);
		return store.setState({ typing });
	}

	if (!isTyping) {
		return store.setState({ typing: typing.filter((u) => u !== username) });
	}
});

Livechat.onMessage(async(message) => {
	if (message.ts instanceof Date) {
		message.ts = message.ts.toISOString();
	}

	await store.setState({
		messages: upsert(store.state.messages, message, ({ _id }) => _id === message._id, ({ ts }) => ts),
	});

	await processMessage(message);

	if (canRenderMessage(message) !== true) {
		return;
	}

	await processUnread();
	await doPlaySound(message);
});
