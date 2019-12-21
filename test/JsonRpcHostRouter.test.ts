import { CancellationToken, SubscriberChannel } from "@zxteam/contract";
import { DUMMY_CANCELLATION_TOKEN } from "@zxteam/cancellation";
import { SubscriberChannelMixin } from "@zxteam/channels";

import { assert } from "chai";

import { JsonRpcHost, JsonRpcHostRouter, Notification, Request, Response } from "../src";

describe("JsonRpcHostRouter tests", function () {
	class MyJsonRpcHost implements JsonRpcHost {
		private readonly _id: string;

		public constructor(id: string) {
			this._id = id;
		}

		public async invoke(cancellationToken: CancellationToken, args: Request): Promise<Response> {
			return { jsonrpc: "2.0", id: args.id, result: this._id };
		}

		public pump() {
			return this.notify({ data: { jsonrpc: "2.0", method: "notify"} });
		}
	}
	interface MyJsonRpcHost extends SubscriberChannelMixin<Notification> { }
	SubscriberChannelMixin.applyMixin(MyJsonRpcHost);


	it("Positive test", async function () {
		const instanceDef = new MyJsonRpcHost("default");
		const instance1 = new MyJsonRpcHost("one");
		const instance2 = new MyJsonRpcHost("two");

		const router = new JsonRpcHostRouter({
			defaultHost: instanceDef,
			prefixSeparator: ":",
			underlayingHosts: {
				"one": instance1,
				"two": instance2
			}
		});


		let eventData: Notification | null = null;
		function handler(event: SubscriberChannel.Event<Notification> | Error) {
			if (event instanceof Error) {
				eventData = null;
				return;
			}

			eventData = event.data;
		}

		router.addHandler(handler);

		const resultDef: Response.Success = (
			await router.invoke(DUMMY_CANCELLATION_TOKEN, { jsonrpc: "2.0", id: 42, method: "test" })
		) as Response.Success;
		assert.equal(resultDef.result, "default");

		const resultOne: Response.Success = (
			await router.invoke(DUMMY_CANCELLATION_TOKEN, { jsonrpc: "2.0", id: 42, method: "one:test" })
		) as Response.Success;
		assert.equal(resultOne.result, "one");

		const resultTwo: Response.Success = (
			await router.invoke(DUMMY_CANCELLATION_TOKEN, { jsonrpc: "2.0", id: 42, method: "two:test" })
		) as Response.Success;
		assert.equal(resultTwo.result, "two");


		assert.isNull(eventData);

		await instanceDef.pump();
		assert.equal(eventData!.method, "notify");

		await instance1.pump();
		assert.equal(eventData!.method, "one:notify");

		await instance2.pump();
		assert.equal(eventData!.method, "two:notify");
	});
});
