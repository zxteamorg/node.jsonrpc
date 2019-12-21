import { InvokeChannel, SubscriberChannel } from "@zxteam/contract";

import { Request, Response, Notification } from "./Types";

export interface JsonRpcHost extends InvokeChannel<Request, Response>, SubscriberChannel<Notification> {
}
