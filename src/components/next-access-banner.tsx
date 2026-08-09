import { ArrowRight, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import type { User } from "@/components/top-bar";
import { Button } from "@/components/ui/button";

const nextAppOrigin =
	process.env.NEXT_PUBLIC_NEXT_APP_ORIGIN ?? "https://next.stardew.app";
const dismissalStoragePrefix = "stardew-next-access-banner-dismissed";
const approvalStoragePrefix = "stardew-next-access-approved";
const approvedAccessUrl = `${nextAppOrigin.replace(/\/$/, "")}/?utm_source=stardew.app&utm_medium=referral&utm_campaign=request_access`;

type AccessStatus = "none" | "pending" | "approved" | "denied";

type AccessResponse = {
	status: AccessStatus;
};

async function readResponse(response: Response) {
	const body = (await response.json()) as AccessResponse & { error?: string };
	if (!response.ok) {
		throw new Error(body.error || "We couldn't check your access right now.");
	}
	return body;
}

export function NextAccessBanner({ user }: { user?: User }) {
	const [isRequesting, setIsRequesting] = useState(false);
	const [dismissalLoaded, setDismissalLoaded] = useState(false);
	const [dismissedStatuses, setDismissedStatuses] = useState<AccessStatus[]>(
		[],
	);
	const [approvalCacheCheckedFor, setApprovalCacheCheckedFor] = useState<
		string | null
	>(null);
	const [hasCachedApproval, setHasCachedApproval] = useState(false);
	const discordId = user?.discord_id;
	const approvalCacheLoaded =
		!discordId || approvalCacheCheckedFor === discordId;
	const statusUrl =
		discordId && approvalCacheLoaded && !hasCachedApproval
			? `${nextAppOrigin}/api/whitelist-apply?discordId=${encodeURIComponent(discordId)}`
			: null;
	const { data, mutate } = useSWR<AccessResponse>(
		statusUrl,
		async (url: string) =>
			readResponse(await fetch(url, { cache: "no-store" })),
		{
			revalidateOnFocus: true,
			refreshInterval: (latest) =>
				latest?.status === "pending" || latest?.status === "denied"
					? 15_000
					: 0,
		},
	);

	useEffect(() => {
		const statuses: AccessStatus[] = ["none", "approved"];
		setDismissedStatuses(
			statuses.filter(
				(status) =>
					localStorage.getItem(`${dismissalStoragePrefix}:${status}`) ===
					"true",
			),
		);
		setDismissalLoaded(true);
	}, []);

	useEffect(() => {
		if (!discordId) {
			setHasCachedApproval(false);
			setApprovalCacheCheckedFor(null);
			return;
		}

		setHasCachedApproval(
			localStorage.getItem(`${approvalStoragePrefix}:${discordId}`) === "true",
		);
		setApprovalCacheCheckedFor(discordId);
	}, [discordId]);

	useEffect(() => {
		if (!discordId || data?.status !== "approved") return;
		localStorage.setItem(`${approvalStoragePrefix}:${discordId}`, "true");
		setHasCachedApproval(true);
	}, [data?.status, discordId]);

	if (!dismissalLoaded || !discordId || !approvalCacheLoaded) return null;
	const status = hasCachedApproval ? "approved" : data?.status;
	if (!status) return null;
	if (status === "pending" || status === "denied") return null;
	if (dismissedStatuses.includes(status)) return null;

	const approved = status === "approved";

	const dismiss = () => {
		localStorage.setItem(`${dismissalStoragePrefix}:${status}`, "true");
		setDismissedStatuses((current) => [...current, status]);
	};

	const requestAccess = async () => {
		if (isRequesting) return;
		if (!discordId) {
			toast.error("Sign in with Discord to request access.");
			return;
		}
		setIsRequesting(true);
		try {
			const result = await readResponse(
				await fetch(`${nextAppOrigin}/api/whitelist-apply`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ discordId }),
				}),
			);
			await mutate(result, { revalidate: false });
			toast.success(
				"Access requested. We'll let you know here when it's ready.",
			);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "We couldn't send your request. Try again.",
			);
		} finally {
			setIsRequesting(false);
		}
	};

	return (
		<aside
			aria-live="polite"
			className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 rounded-2xl bg-white/95 p-4 text-neutral-950 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur dark:bg-neutral-950/95 dark:text-neutral-50 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_18px_60px_rgba(0,0,0,0.5)] sm:bottom-5 sm:p-5 sm:pr-14"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				aria-label="Dismiss this message"
				className="absolute right-1 top-1 h-10 w-10 rounded-xl text-neutral-500 transition-[background-color,color,transform] duration-150 hover:text-neutral-950 active:scale-[0.96] dark:text-neutral-400 dark:hover:text-neutral-50 sm:right-2 sm:top-2"
				onClick={dismiss}
			>
				<X className="h-4 w-4" aria-hidden />
			</Button>

			<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<div
					className={`flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-xl ${
						approved
							? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
							: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
					}`}
				>
					{approved ? (
						<CheckCircle2 className="h-5 w-5" aria-hidden />
					) : (
						<Sparkles className="h-6 w-6" aria-hidden />
					)}
				</div>

				<div className="min-w-0 flex-1">
					<h2 className="text-balance font-semibold">
						{approved
							? "You can now try out the next version of stardew.app!"
							: "Love Stardew Valley and stardew.app?"}
					</h2>
					<p className="text-pretty mt-1 text-sm leading-5 text-neutral-600 dark:text-neutral-400">
						{approved
							? "Your access is ready."
							: "Want to test the next version of the site? Click here to request access!"}
					</p>
				</div>

				{approved ? (
					<Button
						asChild
						size="lg"
						className="min-h-11 h-11 rounded-xl transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96]"
					>
						<a href={approvedAccessUrl}>
							Try it now
							<ArrowRight className="ml-2 h-4 w-4" aria-hidden />
						</a>
					</Button>
				) : (
					<Button
						type="button"
						size="lg"
						className="min-h-11 h-11 rounded-xl transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96]"
						disabled={isRequesting}
						onClick={() => void requestAccess()}
					>
						{isRequesting ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
						) : null}
						{isRequesting ? "Requesting…" : "Request access"}
					</Button>
				)}
			</div>
		</aside>
	);
}
