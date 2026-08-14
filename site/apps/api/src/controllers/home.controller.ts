import type { Request, Response } from "express";
import { ok } from "../lib/response";
import * as homeService from "../services/home.service";

export async function create(req: Request, res: Response) {
  const home = await homeService.createHome(req.user!.sub, req.body.name);
  ok(res, home, 201);
}

export async function list(req: Request, res: Response) {
  const homes = await homeService.listHomesForUser(req.user!.sub);
  ok(res, homes);
}

export async function detail(req: Request, res: Response) {
  const home = await homeService.getHomeDetail(Number(req.params.homeId));
  ok(res, home);
}

export async function rename(req: Request, res: Response) {
  const home = await homeService.renameHome(Number(req.params.homeId), req.body.name);
  ok(res, home);
}

export async function transfer(req: Request, res: Response) {
  const home = await homeService.transferOwnership(
    Number(req.params.homeId),
    Number(req.body.newOwnerId),
  );
  ok(res, home);
}

export async function remove(req: Request, res: Response) {
  await homeService.deleteHome(Number(req.params.homeId));
  ok(res, { message: "Home deleted" });
}
