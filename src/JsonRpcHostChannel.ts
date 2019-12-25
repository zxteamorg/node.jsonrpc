import { CancellationToken, PublisherChannel, SubscriberChannel, InvokeChannel } from "@zxteam/contract";
import { SubscriberChannelMixin } from "@zxteam/channels";
import { Disposable } from "@zxteam/disposable";
import { Ensure, ensureFactory, EnsureError } from "@zxteam/ensure";
import { wrapErrorIfNeeded } from "@zxteam/errors";

import * as _ from "lodash";

import { Request, Response, Notification } from "./Types";
import { JsonRpcHost } from "./JsonRpcHost";

const jsonRcpRequestEnsure: Ensure = ensureFactory();
export class JsonRpcHostChannel extends Disposable implements PublisherChannel<string>, SubscriberChannel<string> {
	private readonly _jsonRpcHost: JsonRpcHost;
	private readonly _boundJsonRpcHostNotification: SubscriberChannel.Callback<Notification>;
	private readonly _disposeCallback: () => void | Promise<void>;

	public constructor(jsonRpcHost: JsonRpcHost, disposeCallback: () => void | Promise<void>) {
		super();

		this._jsonRpcHost = jsonRpcHost;
		this._disposeCallback = disposeCallback;
		this._boundJsonRpcHostNotification = this._onJsonRpcHostNotification.bind(this);
	}

	public async send(cancellationToken: CancellationToken, data: string): Promise<void> {
		this.verifyBrokenChannel();

		let id: Request["id"];
		let method: Request["method"];
		let args: Request["params"] | null;

		try {
			const jsonRpcRequest = JSON.parse(data);

			const peamble: Request["jsonrpc"] = jsonRpcRequest.jsonrpc;
			if (peamble !== "2.0") {
				const errorReponse: Response.Error = {
					jsonrpc: "2.0",
					id: null,
					error: {
						code: Response.ErrorCode.InvalidRequest,
						message: "\"jsonrpc\" should be \"2.0\""
					}
				};

				await this.notify({ data: JSON.stringify(errorReponse) });

				return;
			}

			const rawId = jsonRcpRequestEnsure.defined(jsonRpcRequest.id);
			if (_.isString(rawId)) {
				id = rawId;
			} else if (_.isSafeInteger(rawId)) {
				id = rawId;
			} else {
				const errorReponse: Response.Error = {
					jsonrpc: "2.0",
					id: null,
					error: {
						code: Response.ErrorCode.InvalidRequest,
						message: "\"id\" should be a String or Safe Integer"
					}
				};

				await this.notify({ data: JSON.stringify(errorReponse) });

				return;
			}

			method = jsonRcpRequestEnsure.string(jsonRpcRequest.method);

			if ("params" in jsonRpcRequest) {
				if (jsonRpcRequest.params instanceof Object) {
					args = jsonRpcRequest.params;
				} else {
					const errorReponse: Response.Error = {
						jsonrpc: "2.0",
						id,
						error: {
							code: Response.ErrorCode.InvalidRequest,
							message: "\"params\" should be a Structured value (Array or Object)"
						}
					};

					await this.notify({ data: JSON.stringify(errorReponse) });

					return;
				}
			} else {
				args = null;
			}


		} catch (e) {
			if (e instanceof EnsureError) {
				const errorReponse: Response.Error = {
					jsonrpc: "2.0",
					id: null,
					error: {
						code: Response.ErrorCode.InvalidRequest,
						message: e.message
					}
				};
				await this.notify({ data: JSON.stringify(errorReponse) });
				return;
			} else {
				const err: Error = wrapErrorIfNeeded(e);
				const errorReponse: Response.Error = {
					jsonrpc: "2.0",
					id: null,
					error: {
						code: Response.ErrorCode.ParseError,
						message: err.message
					}
				};
				await this.notify({ data: JSON.stringify(errorReponse) });
				return;
			}
		}

		try {
			const response: Request = args !== null
				? { jsonrpc: "2.0", id, method, params: args }
				: { jsonrpc: "2.0", id, method };

			const result = await this._jsonRpcHost.invoke(cancellationToken, response);

			await this.notify({ data: JSON.stringify(result) });

			return;
		} catch (e) {
			const err: Error = wrapErrorIfNeeded(e);

			const errorReponse: Response.Error = {
				jsonrpc: "2.0",
				id,
				error: {
					code: Response.ErrorCode.InternalError,
					message: err.message
				}
			};

			await this.notify({ data: JSON.stringify(errorReponse) });

			return;
		}
	}

	protected onAddFirstHandler() {
		// We have first subscriber, so subscribe on underlaying channel
		this._jsonRpcHost.addHandler(this._boundJsonRpcHostNotification);
	}

	protected onRemoveLastHandler() {
		// Last subscriber removed, so unsubscribe on underlaying channel
		this._jsonRpcHost.removeHandler(this._boundJsonRpcHostNotification);
	}

	protected onDispose() {
		return this._disposeCallback();
	}

	private _onJsonRpcHostNotification(event: SubscriberChannel.Event<Notification> | Error): void | Promise<void> {
		if (event instanceof Error) {
			return;
		}

		return this.notify({ data: JSON.stringify(event.data) });
	}
}
export interface JsonRpcHostChannel extends SubscriberChannelMixin<string> { }
SubscriberChannelMixin.applyMixin(JsonRpcHostChannel);
