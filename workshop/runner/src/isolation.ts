import { DefaultResourceLoader, type ResourceLoader } from "@earendil-works/pi-coding-agent";

/** Real loader overrides. These are not unsupported feature flags. */
export const WORKSHOP_RESOURCE_ISOLATION = {
	strategy: "explicit-resource-loader-overrides/v1",
	context_files: "EMPTY_OVERRIDE",
	skills: "EMPTY_OVERRIDE",
	extensions: "EMPTY_OVERRIDE",
	prompt_templates: "EMPTY_OVERRIDE",
	themes: "EMPTY_OVERRIDE",
	system_prompt_files: "DISABLED_WITH_EMPTY_SOURCE",
	append_system_prompt_files: "DISABLED_WITH_EMPTY_SOURCE",
} as const;

export function createIsolatedResourceLoader(options: { cwd: string; agentDir: string; harnessRules: string }): ResourceLoader {
	return new DefaultResourceLoader({
		cwd: options.cwd,
		agentDir: options.agentDir,
		// Empty sources block SYSTEM.md and APPEND_SYSTEM.md discovery; Pi builds its normal base prompt.
		systemPrompt: "",
		appendSystemPrompt: [],
		agentsFilesOverride: () => ({ agentsFiles: [] }),
		skillsOverride: () => ({ skills: [], diagnostics: [] }),
		extensionsOverride: (base) => ({ ...base, extensions: [], errors: [] }),
		promptsOverride: () => ({ prompts: [], diagnostics: [] }),
		themesOverride: () => ({ themes: [], diagnostics: [] }),
		systemPromptOverride: (base) => `${base ?? ""}\n\n${options.harnessRules}`,
	});
}
