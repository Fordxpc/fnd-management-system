export function canEditRamp(staff: any) {
  return (
    staff?.department === "Ground Operations" ||
    staff?.rampsheetEditAccess === true
  );
}

export function canEditBirdCount(staff: any) {
  return (
    staff?.department === "Ground Operations" ||
    staff?.birdCountEditAccess === true
  );
}

export function canEditRunwayLights(staff: any) {
  return (
    staff?.department === "Safety" ||
    staff?.rwyLightEditAccess === true
  );
}

export function canAccessOpsBoard(staff: any) {
  return (
    staff?.department === "Ground Operations" ||
    staff?.opsBoardAccess === true
  );
}

export function isDepartmentIncharge(staff: any) {
  return staff?.isIncharge === true;
}