import * as select from 'select-dom';
import * as ghInjection from 'github-injection';
import { ConfigProvider } from '../config';
import { ButtonInjector, InjectorBase, checkIsBtnUpToDate } from './injector';
import { renderGitpodUrl } from '../utils';

namespace Gitpodify {
	export const NAV_BTN_ID = "gitpod-btn-nav";
	export const NAV_BTN_CLASS = "gitpod-nav-btn";
    export const NAV_BTN_CLASS_SELECTOR = "." + NAV_BTN_CLASS;
    
    export const CSS_REF_BTN_CONTAINER = "gitpod-btn-container";
    export const CSS_REF_NO_CONTAINER = "no-container";
}

/**
 * This implementation currently assumes that there is only ever one button per page
 */
export class GitHubInjector extends InjectorBase {

    constructor(configProvider: ConfigProvider) {
        super(configProvider, [
            new PullInjector(),
            new IssueInjector(),
            new FileInjector(),
            new NavigationInjector(),
            new EmptyRepositoryInjector(),
        ]);
    }

    canHandleCurrentPage(): boolean {
        // TODO Does this work for GitHub Enterprise, too?
        const metaTags = document.getElementsByTagName("meta");
        for (let i = 0; i < metaTags.length; i++) {
            const metaTag = metaTags[i];
            if (metaTag.name === "hostname" && metaTag.content.includes("github")) {
                return true;
            }
        }
        return false;
    }

    checkIsInjected(): boolean {
        const button = document.getElementById(`${Gitpodify.NAV_BTN_ID}`);
        const currentUrl = renderGitpodUrl(this.config.gitpodURL);
        return checkIsBtnUpToDate(button, currentUrl);
    }

    async inject(): Promise<void> {
        // ghInjection triggers an event whenever only parts of the GitHub page have been reloaded
	    ghInjection(() => {
            if (!this.checkIsInjected()) {
                this.injectButtons();
            }
        });
    }

    async update(): Promise<void> {
        this.injectButtons();
    }
}

abstract class ButtonInjectorBase implements ButtonInjector {

    constructor(
        protected readonly parentSelector: string,
        protected readonly btnClasses: string,
        protected readonly float: boolean = true,
        protected readonly asFirstChild: boolean = false
    ) {}

    abstract isApplicableToCurrentPage(): boolean;

    inject(currentUrl: string) {
        const actionbar = select(this.parentSelector);
        if (!actionbar) {
            return;
        }

        const oldBtn = document.getElementById(Gitpodify.NAV_BTN_ID);
        if (oldBtn) {
            if (!checkIsBtnUpToDate(oldBtn, currentUrl)) {
                // update button
                (oldBtn as HTMLAnchorElement).href = currentUrl;
            }
            // button is there and up-to-date
            return;
        }

        const btn = this.renderButton(currentUrl);

        const btnGroup = actionbar.getElementsByClassName("BtnGroup");
        if (btnGroup && btnGroup.length > 0 && btnGroup[0].classList.contains('float-right')){
            actionbar.insertBefore(btn, btnGroup[0]);
        } else if (this.asFirstChild && actionbar) {
            actionbar.insertBefore(btn, actionbar.firstChild);
        } else {
            actionbar.appendChild(btn);
        }
    }

    protected renderButton(url: string): HTMLElement {
        let classes = this.btnClasses + ` ${Gitpodify.NAV_BTN_CLASS}`;
        if (this.float) {
            classes = classes + ` float-right`;
        }

        const container = document.createElement('div');
        container.id = Gitpodify.CSS_REF_BTN_CONTAINER;
        container.className = classes;

        const a = document.createElement('a');
        a.id = Gitpodify.NAV_BTN_ID;
        a.title = "Gitpod";
        a.text = "Gitpod"
        a.href = url;
        a.target = "_blank";
        a.className = "btn btn-primary";

        this.adjustButton(a);

        container.appendChild(a);
        return container;
    }
    protected adjustButton(a: HTMLAnchorElement) {
        // do nothing
    }
}

class PullInjector extends ButtonInjectorBase {
    constructor() {
        super(".gh-header-actions", "");
    }

    isApplicableToCurrentPage(): boolean {
		return window.location.pathname.includes("/pull/");
    }

    protected adjustButton(a: HTMLAnchorElement): void {
        a.className = "btn btn-sm btn-primary";
    }
}

class IssueInjector extends ButtonInjectorBase {
    constructor() {
        super(".gh-header-actions", "");
    }

    isApplicableToCurrentPage(): boolean {
		return window.location.pathname.includes("/issues/");
    }
}

class FileInjector extends ButtonInjectorBase {
    constructor() {
        super(".repository-content > div", "gitpod-file-btn");
    }

    isApplicableToCurrentPage(): boolean {
        return window.location.pathname.includes("/blob/");
    }
}

class NavigationInjector extends ButtonInjectorBase {
    constructor() {
        super(".file-navigation", "empty-icon position-relative");
    }

    isApplicableToCurrentPage(): boolean {
        return !!select.exists(".file-navigation");
    }
}

class EmptyRepositoryInjector extends ButtonInjectorBase {
    constructor() {
        super(".repository-content", Gitpodify.CSS_REF_NO_CONTAINER, false, true);
    }

    isApplicableToCurrentPage(): boolean {
        return !!select.exists("git-clone-help-controller");
    }
}
