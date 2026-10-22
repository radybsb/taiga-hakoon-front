###
# This source code is licensed under the terms of the
# GNU Affero General Public License found in the LICENSE file in
# the root directory of this source tree.
#
# Copyright (c) 2021-present Kaleidos INC
###

UserTimelineAttachmentDirective = (template, $compile) ->
    # Ignore signed URL parameters when identifying the attachment format.
    extensionOf = (value) ->
        path = (value || '').split(/[?#]/)[0]
        return path.toLowerCase().match(/\.[a-z0-9]+$/)?[0]

    link = (scope, el) ->
        extension = extensionOf(scope.attachment.get('filename')) || extensionOf(scope.attachment.get('url'))
        kind = if extension in ['.jpg', '.jpeg', '.bmp', '.gif', '.png', '.webp'] then '-image' else ''
        kind = '-video' if extension == '.mp4'
        templateHtml = template.get("user-timeline/user-timeline-attachment/user-timeline-attachment#{kind}.html")

        el.html(templateHtml)
        $compile(el.contents())(scope)

        el.find("img").error () -> @.remove()

        # Keep playback in the timeline and omit the browser's download menu.
        videos = el.find("video")
        preventContextMenu = (event) -> event.preventDefault()
        videos.on("contextmenu", preventContextMenu)
        scope.$on "$destroy", -> videos.off("contextmenu", preventContextMenu)

    return {
        link: link
        scope: {
            attachment: "=tgUserTimelineAttachment"
        }
    }

UserTimelineAttachmentDirective.$inject = [
    "$tgTemplate",
    "$compile"
]

angular.module("taigaUserTimeline")
    .directive("tgUserTimelineAttachment", UserTimelineAttachmentDirective)
