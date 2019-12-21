import { CancellationToken, SubscriberChannel } from "@zxteam/contract";
import { SubscriberChannelMixin } from "@zxteam/channels";

import * as _ from "lodash";

import { Request, Response, Notification } from "./Types";
import { JsonRpcHost } from "./JsonRpcHost";


export class JsonRpcHostRouter implements JsonRpcHost {
	private readonly _routerMap: Map<string, {
		readonly host: JsonRpcHost;
		boundNotify: SubscriberChannel.Callback<Notification> | null;
	}>;
	private readonly _defaultHost: JsonRpcHost;
	private readonly _prefixSeparator: string;
	private readonly _boundNotify: SubscriberChannel.Callback<Notification>;

	public constructor(opts: JsonRpcHostRouter.Opts) {
		this._routerMap = new Map();
		_.entries(opts.underlayingHosts).forEach(([prefix, jsonRpcHost]) => {
			const tuple = {
				host: jsonRpcHost,
				boundNotify: null
			};
			this._routerMap.set(prefix, tuple);
		});
		this._defaultHost = opts.defaultHost;
		this._prefixSeparator = opts.prefixSeparator;

		this._boundNotify = this.notify.bind(this);
	}

	public invoke(cancellationToken: CancellationToken, args: Request): Promise<Response> {
		const { jsonrpc, id, method, params } = args;

		const indexOfSerparator = method.indexOf(this._prefixSeparator);

		if (indexOfSerparator !== -1) {
			const prefix: string = method.substring(0, indexOfSerparator);
			const submethod: string = method.substring(indexOfSerparator + 1);
			const subhostTuple = this._routerMap.get(prefix);
			if (subhostTuple !== undefined) {
				return subhostTuple.host.invoke(cancellationToken, { jsonrpc, id, method: submethod, params });
			}
		}

		return this._defaultHost.invoke(cancellationToken, { jsonrpc, id, method, params });
	}

	protected onAddFirstHandler() {
		// We have first subscriber, so subscribe on underlaying channel

		this._defaultHost.addHandler(this._boundNotify);

		for (const [prefix, subhostTuple] of this._routerMap.entries()) {
			subhostTuple.boundNotify = (event: SubscriberChannel.Event<Notification> | Error) => {
				if (this.isBroken) {
					console.warn("Cannot route event to broken channel", event);
					return;
				}

				if (event instanceof Error) {
					return this.notify(event);
				}

				const data = { ...event.data }; // make copy
				data.method = `${prefix}${this._prefixSeparator}${data.method}`;
				this.notify({ data: Object.freeze(data) });
			};
			subhostTuple.host.addHandler(subhostTuple.boundNotify);
		}
	}

	protected onRemoveLastHandler() {
		// Last subscriber removed, so unsubscribe on underlaying channel

		this._defaultHost.removeHandler(this._boundNotify);

		for (const subhostTuple of this._routerMap.values()) {
			if (subhostTuple.boundNotify !== null) {
				subhostTuple.host.removeHandler(subhostTuple.boundNotify);
			}
		}
	}
}
export namespace JsonRpcHostRouter {
	export interface Opts {
		readonly defaultHost: JsonRpcHost;
		readonly prefixSeparator: string;
		readonly underlayingHosts: {
			readonly [prefix: string]: JsonRpcHost;
		};
	}
}
export interface JsonRpcHostRouter extends SubscriberChannelMixin<Notification> { }
SubscriberChannelMixin.applyMixin(JsonRpcHostRouter);
