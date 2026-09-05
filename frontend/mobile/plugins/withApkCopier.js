const { withAppBuildGradle } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Expo Config Plugin to automatically copy the compiled APK to the server directory
 * after every successful Gradle build.
 */
const withApkCopier = (config) => {
    return withAppBuildGradle(config, (config) => {
        // Only inject if not already present to prevent duplicate tasks on multiple prebuilds
        if (config.modResults.contents.includes('task copyApkToServer')) {
            return config;
        }

        const task = `
// [SwitchNest] Custom Task to copy APK to server directory
task copyApkToServer(type: Copy) {
    def apkDir = file("$buildDir/outputs/apk/release")
    def destDir = file("../../../../../mobile-app")
    
    from apkDir
    into destDir
    include "app-release.apk"
    rename "app-release.apk", "SwitchNest_Latest.apk"
    
    doLast {
        println "✅ [SwitchNest OTA] Successfully copied Release APK to \${destDir}/SwitchNest_Latest.apk"
    }
}

// Hook it to run right after the assembleRelease task
tasks.whenTaskAdded { task ->
    if (task.name == 'assembleRelease') {
        task.finalizedBy 'copyApkToServer'
    }
}
`;
        config.modResults.contents = config.modResults.contents + '\n' + task;
        return config;
    });
};

module.exports = withApkCopier;
