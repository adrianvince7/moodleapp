// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Injectable } from '@angular/core';
import { CoreDomUtilsProvider } from '@providers/utils/dom';
import { CoreCourseProvider } from '@core/course/providers/course';
import { CoreCourseHelperProvider } from '@core/course/providers/helper';
import { AddonModResourceProvider } from './resource';
import { TranslateService } from '@ngx-translate/core';
import { CoreSitesProvider } from '@providers/sites';
import { CoreUtilsProvider } from '@providers/utils/utils';
import { CoreFilepoolProvider } from '@providers/filepool';
import { CoreFileProvider } from '@providers/file';
import { CoreAppProvider } from '@providers/app';
import { CoreMimetypeUtilsProvider } from '@providers/utils/mimetype';
import { CoreTextUtilsProvider } from '@providers/utils/text';
import { CoreConstants } from '@core/constants';

/**
 * Service that provides helper functions for resources.
 */
@Injectable()
export class AddonModResourceHelperProvider {

    /* Constants to determine how a resource should be displayed in Moodle. */
    // Try the best way.
    protected DISPLAY_AUTO = 0;
    // Display using object tag.
    protected DISPLAY_EMBED = 1;

    constructor(private courseProvider: CoreCourseProvider, private domUtils: CoreDomUtilsProvider,
            private resourceProvider: AddonModResourceProvider, private courseHelper: CoreCourseHelperProvider,
            private textUtils: CoreTextUtilsProvider, private mimetypeUtils: CoreMimetypeUtilsProvider,
            private fileProvider: CoreFileProvider, private appProvider: CoreAppProvider,
            private filepoolProvider: CoreFilepoolProvider, private utils: CoreUtilsProvider,
            private sitesProvider: CoreSitesProvider, private translate: TranslateService) {
    }

    /**
     * Get the HTML to display an embedded resource.
     *
     * @param {any} module The module object.
     * @return {Promise<any>}      Promise resolved with the iframe src.
     */
    getEmbeddedHtml(module: any): Promise<any> {
        return this.courseHelper.downloadModuleWithMainFileIfNeeded(module, module.course, AddonModResourceProvider.COMPONENT,
                module.id, module.contents).then((result) => {
            const file = module.contents[0],
                ext = this.mimetypeUtils.getFileExtension(file.filename),
                type = this.mimetypeUtils.getExtensionType(ext),
                mimeType = this.mimetypeUtils.getMimeType(ext);

            if (type == 'image') {
                return '<img src="' + result.path + '"></img>';
            }

            if (type == 'audio' || type == 'video') {
                return '<' + type + ' controls title="' + file.filename + '"" src="' + result.path + '">' +
                    '<source src="' + result.path + '" type="' + mimeType + '">' +
                    '</' + type + '>';
            }

            // Shouldn't reach here, the user should have called CoreMimetypeUtilsProvider#canBeEmbedded.
            return '';
        });
    }

    /**
     * Download all the files needed and returns the src of the iframe.
     *
     * @param {any} module The module object.
     * @return {Promise<string>} Promise resolved with the iframe src.
     */
    getIframeSrc(module: any): Promise<string> {
        if (!module.contents.length) {
            return Promise.reject(null);
        }

        const mainFile = module.contents[0];
        let mainFilePath = mainFile.filename;

        if (mainFile.filepath !== '/') {
            mainFilePath = mainFile.filepath.substr(1) + mainFilePath;
        }

        return this.filepoolProvider.getPackageDirUrlByUrl(this.sitesProvider.getCurrentSiteId(), module.url).then((dirPath) => {
            // This URL is going to be injected in an iframe, we need trustAsResourceUrl to make it work in a browser.
            return this.textUtils.concatenatePaths(dirPath, mainFilePath);
        }).catch(() => {
            // Error getting directory, there was an error downloading or we're in browser. Return online URL.
            if (this.appProvider.isOnline() && mainFile.fileurl) {
                // This URL is going to be injected in an iframe, we need this to make it work.
                return Promise.resolve(this.sitesProvider.getCurrentSite().fixPluginfileURL(mainFile.fileurl));
            }

            return Promise.reject(null);
        });
    }

    /**
     * Whether the resource has to be displayed embedded.
     *
     * @param {any} module    The module object.
     * @param {number} [display] The display mode (if available).
     * @return {boolean}         Whether the resource should be displayed embeded.
     */
    isDisplayedEmbedded(module: any, display: number): boolean {
        if (!module.contents.length || !this.fileProvider.isAvailable()) {
            return false;
        }

        const ext = this.mimetypeUtils.getFileExtension(module.contents[0].filename);

        return (display == this.DISPLAY_EMBED || display == this.DISPLAY_AUTO) && this.mimetypeUtils.canBeEmbedded(ext);
    }

    /**
     * Whether the resource has to be displayed in an iframe.
     *
     * @param {any} module The module object.
     * @return {boolean}   Whether the resource should be displayed in an iframe.
     */
    isDisplayedInIframe(module: any): boolean {
        if (!module.contents.length || !this.fileProvider.isAvailable()) {
            return false;
        }

        const ext = this.mimetypeUtils.getFileExtension(module.contents[0].filename),
            mimetype = this.mimetypeUtils.getMimeType(ext);

        return mimetype == 'text/html';
    }

    /**
     * Opens a file of the resource activity.
     *
     * @param  {any} module        Module where to get the contents.
     * @param  {number} courseId   Course Id, used for completion purposes.
     * @return {Promise<any>}      Resolved when done.
     */
    openModuleFile(module: any, courseId: number): Promise<any> {
        const modal = this.domUtils.showModalLoading();

        // Download and open the file from the resource contents.
        return this.courseHelper.downloadModuleAndOpenFile(module, courseId, AddonModResourceProvider.COMPONENT, module.id,
                module.contents).then(() => {
            this.resourceProvider.logView(module.instance).then(() => {
                this.courseProvider.checkModuleCompletion(courseId, module.completionstatus);
            });
        }).catch((error) => {
            this.domUtils.showErrorModalDefault(error, 'addon.mod_resource.errorwhileloadingthecontent', true);
        }).finally(() => {
            modal.dismiss();
        });
    }
}
