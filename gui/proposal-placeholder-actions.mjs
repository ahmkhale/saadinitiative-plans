import {
  createElectivePlaceholder,
  proposalElectiveOptions,
} from "./proposal-actions.mjs";

export function createProposalPlaceholderActions({
  state,
  askForm,
  changed,
  setStatus,
}) {
  async function addPlaceholder(card) {
    const options = proposalElectiveOptions(state.resolved?.electiveGroups ?? [], state.plan.proposal);
    if (!options.length) {
      setStatus("اكتملت الساعات المطلوبة لكل مجموعات المقررات الاختيارية.", "success");
      return;
    }
    const values = await askForm({
      title: "إضافة مقرر نائب اختياري",
      message: "اختر المجموعة. سيُخصم مقرر واحد من ساعاتها المتبقية، وتبقى ساعات البطاقة شرطات حتى اختيار المقرر الحقيقي.",
      fields: [{
        name: "electiveGroupId",
        label: "المجموعة الاختيارية",
        options: options.map((option) => ({
          value: option.id,
          label: `${option.name} — المتبقي ${option.remainingHours} ساعات`,
        })),
      }],
    });
    if (!values) return;
    const option = options.find((item) => item.id === values.electiveGroupId);
    if (!option) throw new Error("لم يُعثر على المجموعة الاختيارية.");
    const semester = state.plan.proposal.semesters[Number(card.dataset.groupIndex)];
    semester.placeholders ??= [];
    semester.placeholders.push(createElectivePlaceholder(option));
    changed(true);
  }

  async function editPlaceholder(row) {
    const semester = state.plan.proposal.semesters[Number(row.dataset.groupIndex)];
    const placeholder = semester.placeholders.find((item) => item.id === row.dataset.placeholderId);
    if (!placeholder) throw new Error("لم يُعثر على المقرر النائب.");
    const values = await askForm({
      title: "تعديل المقرر النائب",
      message: "سيبقى رمز البطاقة «مقرر»، وسيظهر المقرر بعد جميع المقررات الأصلية.",
      fields: placeholder.hoursDisplay === "unknown" ? [
        { name: "name", label: "وصف المقرر", value: placeholder.name },
        { name: "allocationHours", label: "الساعات المحتسبة من المتطلب", type: "number", min: 0, value: placeholder.allocationHours ?? 0 },
      ] : [
        { name: "name", label: "وصف المقرر", value: placeholder.name },
        { name: "academicHours", label: "الساعات الأكاديمية", type: "number", min: 0, value: placeholder.academicHours ?? 0 },
        { name: "lectureHours", label: "ساعات المحاضرة", type: "number", min: 0, value: placeholder.lectureHours ?? 0 },
        { name: "exerciseHours", label: "ساعات التمارين", type: "number", min: 0, value: placeholder.exerciseHours ?? 0 },
        { name: "practicalHours", label: "ساعات العملي", type: "number", min: 0, value: placeholder.practicalHours ?? 0 },
      ],
    });
    if (!values) return;
    if (placeholder.hoursDisplay === "unknown") {
      placeholder.name = values.name;
      placeholder.allocationHours = Number(values.allocationHours);
    } else {
      Object.assign(placeholder, {
        name: values.name,
        academicHours: Number(values.academicHours),
        lectureHours: Number(values.lectureHours),
        exerciseHours: Number(values.exerciseHours),
        practicalHours: Number(values.practicalHours),
        color: "#000000",
      });
    }
    changed(true);
  }

  return { addPlaceholder, editPlaceholder };
}
